
import * as SecureStore from "expo-secure-store";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.148.57.86:8000";
const TOKEN_KEY = "pennywise.auth-token";

// Stores the authenticated user's JWT token
let authToken: string | null = null;

// Set or clear authentication token
export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) SecureStore.setItemAsync(TOKEN_KEY, token).catch(() => undefined);
  else SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
}

export async function restoreAuthToken() {
  try { authToken = await SecureStore.getItemAsync(TOKEN_KEY); } catch { authToken = null; }
  return authToken;
}

// Check whether a token is available
export function isAuthenticated(): boolean {
  return authToken !== null;
}

// Generic API request function
export async function apiRequest<T>(
  endpoint: string,
  method: string = "GET",
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
    });
  } catch {
    throw new Error(
      "Cannot connect to PennyWise server. Check your internet connection and backend."
    );
  }

  const responseText = await response.text();

  let data: any = null;

  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    throw new Error("The backend returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(
      data?.detail || `Request failed with status ${response.status}`
    );
  }

  return data as T;
}

// Login function
export async function loginUser(
  username: string,
  password: string
) {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        username,
        password,
      }).toString(),
    });
  } catch {
    throw new Error("Unable to connect to the login server.");
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Login failed.");
  }

  if (!data.access_token) {
    throw new Error("Login succeeded but no access token was returned.");
  }

  setAuthToken(data.access_token);

  return data;
}

export async function registerUser(data: { Username: string; Email: string; FullName: string; Password: string; Phone?: string }) {
  return apiRequest<{ UserID: number; Username: string; message: string; account_count: number; total_balance: string }>("/register", "POST", data);
}

// Get currently logged-in user's profile
export async function getCurrentUser() {
  return apiRequest<{
    UserID: number;
    Username: string;
    FullName: string;
    Email: string;
    Phone?: string;
    CreatedAt?: string;
  }>("/users");
}

export type Account = { AccountID: number; AccountName: string; AccountType: string; Balance: number; Currency: string; IsActive: boolean };
export type Transaction = { TransactionID: number; AccountID: number; CategoryID: number; Amount: number; TransactionType: "INCOME" | "EXPENSE"; Description?: string; Merchant?: string; TransactionDate?: string };
export type Category = { CategoryID: number; CategoryName: string; CategoryType: "INCOME" | "EXPENSE" };
export const getAccounts = () => apiRequest<Account[]>("/accounts");
export const createAccount = (data: { AccountName: string; AccountType: string; Currency?: string }) => apiRequest("/accounts", "POST", data);
export const getTransactions = () => apiRequest<Transaction[]>("/transactions");
export const searchTransactions = (filters: {
  text?: string;
  category_id?: number; account_id?: number; transaction_type?: "INCOME" | "EXPENSE";
  start_date?: string; end_date?: string; min_amount?: number; max_amount?: number;
}) => {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])).toString();
  return apiRequest<{ transactions: Transaction[]; total: number; count: number }>(`/transactions?${query}`);
};
export type Notification = { NotificationID: number; NotificationType: string; Message: string; IsRead: boolean; CreatedAt?: string };
export const getNotifications = () => apiRequest<Notification[]>("/notifications");
export const markNotificationRead = (id: number | string) => apiRequest(`/notifications/${id}/read`, "PATCH");
export const getCategories = () => apiRequest<Category[]>("/categories");
export const createCategory = (data: { CategoryName: string; CategoryType: "INCOME" | "EXPENSE" }) => apiRequest<Category>("/categories", "POST", data);
export const createTransaction = (data: Omit<Transaction, "TransactionID">) => apiRequest("/transactions", "POST", data);
export const updateTransaction = (id: number, data: Partial<Omit<Transaction, "TransactionID">>) => apiRequest(`/transactions/${id}`, "PUT", data);
export const deleteTransaction = (id: number) => apiRequest(`/transactions/${id}`, "DELETE");
export const createTransfer = (data: { SourceAccountID: number; DestinationAccountID: number; Amount: number; Description?: string }) => apiRequest("/transfers", "POST", data);
export const getBudgets = () => apiRequest<any[]>("/budgets");
export const createBudget = (data: { CategoryID: number; BudgetAmount: number; BudgetPeriod: string; StartDate: string; EndDate: string }) => apiRequest("/budgets", "POST", data);
export const deleteBudget = (id: number) => apiRequest(`/budgets/${id}`, "DELETE");
export const getSavingsGoals = () => apiRequest<any[]>("/savings-goals");
export const createSavingsGoal = (data: { GoalName: string; TargetAmount: number; Deadline?: string }) => apiRequest("/savings-goals", "POST", data);
export const contributeToSavingsGoal = (id: number, data: { Amount: number; Note?: string }) => apiRequest(`/savings-goals/${id}/contributions`, "POST", data);
export const getRecurringTransactions = () => apiRequest<any[]>("/recurring-transactions");
export const getSummary = () => apiRequest<{balance: number; income: number; expenses: number; accounts: number}>("/summary");
export const getReconciliation = (month: string) => apiRequest<any[]>(`/reconciliation?month=${encodeURIComponent(month)}`);

// Check backend health
export async function checkBackend() {
  return apiRequest<{ status: string }>("/health");
}

// Logout
export function logoutUser() {
  setAuthToken(null);
}
