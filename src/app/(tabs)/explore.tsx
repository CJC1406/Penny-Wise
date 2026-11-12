import React, { useEffect, useMemo, useState } from 'react';
import { createCategory, createTransaction, deleteTransaction, getAccounts, getCategories, getTransactions, type Transaction as ApiTransaction, type Account, type Category } from '@/services/api';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Transaction = {
  id: string;
  title: string;
  category: string;
  date: string;
  amount: number;
  type: 'income' | 'expense';
};

const categories = [
  'Food',
  'Transport',
  'Shopping',
  'Education',
  'Utilities',
  'Entertainment',
  'Health',
  'Other',
];

export default function TransactionsScreen() {
  const params = useLocalSearchParams<{ type?: string }>();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<'All' | 'Income' | 'Expenses'>('All');
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [backendCategories, setBackendCategories] = useState<Category[]>([]);

  const refreshFinancialData = React.useCallback(() => { Promise.all([getTransactions(), getAccounts(), getCategories()]).then(([items, loadedAccounts, loadedCategories]) => { setTransactions((items as ApiTransaction[]).map((item) => ({ id: String(item.TransactionID), title: item.Description || item.TransactionType, category: item.TransactionType, date: item.TransactionDate ? new Date(item.TransactionDate).toLocaleDateString() : '', amount: Number(item.Amount), type: item.TransactionType === 'INCOME' ? 'income' : 'expense' }))); setAccounts(loadedAccounts); setBackendCategories(loadedCategories); }).catch(() => Alert.alert('Error', 'Unable to load financial data.')); }, []);
  useFocusEffect(React.useCallback(() => { refreshFinancialData(); }, [refreshFinancialData]));

  useEffect(() => {
    const requestedType = params.type?.toLowerCase();

    if (requestedType === 'income' || requestedType === 'expense') {
      const handle = setTimeout(() => { setType(requestedType); setShowForm(true); }, 0);
      return () => clearTimeout(handle);
    }
  }, [params.type]);

  const totalIncome = useMemo(
    () => transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const totalExpenses = useMemo(
    () => transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const visibleTransactions = transactions.filter(t => {
    if (filter === 'Income') return t.type === 'income';
    if (filter === 'Expenses') return t.type === 'expense';
    return true;
  });

  async function saveTransaction() {
    const value = Number(amount);

    if (!description.trim()) {
      Alert.alert('Missing description', 'Enter a transaction description.');
      return;
    }

    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      Alert.alert('Invalid amount', 'Enter an amount greater than zero.');
      return;
    }

    const account = accounts[0];
    const transactionType = type === 'income' ? 'INCOME' : 'EXPENSE';
    if (!account) { Alert.alert('Setup required', 'Create an account before recording a transaction.'); return; }
    try {
      let matchingCategory = backendCategories.find((item) => item.CategoryType === transactionType && (type === 'income' || item.CategoryName.toLowerCase() === category.toLowerCase()))
        ?? backendCategories.find((item) => item.CategoryType === transactionType);
      if (!matchingCategory) {
        matchingCategory = await createCategory({ CategoryName: type === 'income' ? 'Income' : category, CategoryType: transactionType });
        setBackendCategories((current) => [...current, matchingCategory!]);
      }
      await createTransaction({ AccountID: account.AccountID, CategoryID: matchingCategory.CategoryID, Amount: value, TransactionType: transactionType, Description: description.trim() });
      const refreshed = await getTransactions();
      setTransactions(refreshed.map((item) => ({ id: String(item.TransactionID), title: item.Description || item.TransactionType, category: item.TransactionType, date: item.TransactionDate ? new Date(item.TransactionDate).toLocaleDateString() : '', amount: Number(item.Amount), type: item.TransactionType === 'INCOME' ? 'income' : 'expense' })));
    } catch (e) { Alert.alert('Could not save transaction', e instanceof Error ? e.message : 'Try again.'); return; }
    setAmount('');
    setDescription('');
    setCategory('Food');
    setType('expense');
    setShowForm(false);
    setFilter('All');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.container}
      >
        <Text style={styles.heading}>Transactions</Text>
        <Text style={styles.subtitle}>Track where your money goes.</Text>

        <View style={styles.summary}>
          <View>
            <Text style={styles.label}>TOTAL INCOME</Text>
            <Text style={styles.income}>₹{totalIncome.toLocaleString('en-IN')}</Text>
          </View>
          <View>
            <Text style={styles.label}>TOTAL EXPENSES</Text>
            <Text style={styles.expense}>₹{totalExpenses.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowForm(!showForm)}
        >
          <Text style={styles.addButtonText}>
            {showForm ? '− Close form' : '+ Add transaction'}
          </Text>
        </TouchableOpacity>

        {showForm && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>New transaction</Text>

            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeButton, type === 'expense' && styles.selectedExpense]}
                onPress={() => setType('expense')}
              >
                <Text style={[styles.typeText, type === 'expense' && styles.selectedText]}>
                  Expense
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeButton, type === 'income' && styles.selectedIncome]}
                onPress={() => setType('income')}
              >
                <Text style={[styles.typeText, type === 'income' && styles.selectedText]}>
                  Income
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Amount (₹)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter amount"
              placeholderTextColor="#A0AAA3"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Grocery shopping"
              placeholderTextColor="#A0AAA3"
              value={description}
              onChangeText={setDescription}
              maxLength={100}
            />

            {type === 'expense' && (
              <>
                <Text style={styles.inputLabel}>Category</Text>
                <View style={styles.categoryList}>
                  {categories.map(item => (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.categoryButton,
                        category === item && styles.selectedCategory,
                      ]}
                      onPress={() => setCategory(item)}
                    >
                      <Text style={[
                        styles.categoryButtonText,
                        category === item && styles.selectedCategoryText,
                      ]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <TouchableOpacity style={styles.saveButton} onPress={saveTransaction}>
              <Text style={styles.saveButtonText}>Save transaction</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.filterRow}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={styles.sectionTitle}>All transactions</Text><TouchableOpacity onPress={() => router.push('/search' as any)}><Text style={{ color: '#176B45', fontWeight: '700' }}>Advanced search</Text></TouchableOpacity></View>
        </View>

        <View style={styles.filters}>
          {(['All', 'Income', 'Expenses'] as const).map(item => (
            <TouchableOpacity
              key={item}
              style={[styles.filterButton, filter === item && styles.activeFilter]}
              onPress={() => setFilter(item)}
            >
              <Text style={[
                styles.filterText,
                filter === item && styles.activeFilterText,
              ]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {visibleTransactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No transactions found.</Text>
          </View>
        ) : (
          visibleTransactions.map(item => (
            <View key={item.id} style={styles.transaction}>
              <View style={styles.icon}>
                <Text style={styles.iconText}>
                  {item.type === 'income' ? 'I' : item.category.charAt(0)}
                </Text>
              </View>

              <View style={styles.details}>
                <Text style={styles.transactionTitle}>{item.title}</Text>
                <Text style={styles.categoryText}>
                  {item.category} · {item.date}
                </Text>
              </View>

              <Text style={[
                styles.transactionAmount,
                item.type === 'income' && styles.income,
              ]}>
                {item.type === 'income' ? '+' : '-'}₹{item.amount.toLocaleString('en-IN')}
              </Text>
              <TouchableOpacity style={styles.deleteButton} onPress={() => Alert.alert('Delete transaction?', 'The account balance will be updated.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteTransaction(Number(item.id)); refreshFinancialData(); } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Unable to delete transaction.'); } } }])}>
                <Text style={styles.deleteText}>×</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <Text style={styles.footer}>PennyWise · Your money, your control</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9F7' },
  container: { padding: 22, paddingTop: 25, paddingBottom: 35 },
  heading: { fontSize: 28, fontWeight: '700', color: '#18251E' },
  subtitle: { fontSize: 13, color: '#89958E', marginTop: 7, marginBottom: 25 },
  summary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  label: { color: '#89958E', fontSize: 10, fontWeight: '700', marginBottom: 9 },
  income: { color: '#23935A', fontSize: 19, fontWeight: '700' },
  expense: { color: '#25332A', fontSize: 19, fontWeight: '700' },
  addButton: {
    backgroundColor: '#176B45',
    padding: 16,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 25,
  },
  addButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  form: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 19, marginBottom: 27 },
  formTitle: { fontSize: 19, color: '#18251E', fontWeight: '700', marginBottom: 17 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  typeButton: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    backgroundColor: '#F2F5F2',
    alignItems: 'center',
  },
  selectedExpense: { backgroundColor: '#176B45' },
  selectedIncome: { backgroundColor: '#23935A' },
  typeText: { color: '#65736A', fontWeight: '600' },
  selectedText: { color: '#FFFFFF' },
  inputLabel: { color: '#45534A', fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#E4EAE5',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#18251E',
  },
  categoryList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 3 },
  categoryButton: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F2F5F2', borderRadius: 20 },
  selectedCategory: { backgroundColor: '#DDEDE2' },
  categoryButtonText: { color: '#65736A', fontSize: 11, fontWeight: '600' },
  selectedCategoryText: { color: '#176B45' },
  saveButton: { backgroundColor: '#176B45', padding: 16, borderRadius: 13, alignItems: 'center', marginTop: 23 },
  saveButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  filterRow: { marginBottom: 13 },
  sectionTitle: { color: '#18251E', fontSize: 18, fontWeight: '700' },
  filters: { flexDirection: 'row', gap: 9, marginBottom: 17 },
  filterButton: { paddingHorizontal: 17, paddingVertical: 9, backgroundColor: '#EAF0EB', borderRadius: 20 },
  activeFilter: { backgroundColor: '#176B45' },
  filterText: { color: '#65736A', fontSize: 12, fontWeight: '600' },
  activeFilterText: { color: '#FFFFFF' },
  transaction: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 15,
    marginBottom: 11,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EAF2EC', justifyContent: 'center', alignItems: 'center' },
  iconText: { color: '#176B45', fontSize: 17, fontWeight: '700' },
  details: { flex: 1, marginLeft: 12 },
  transactionTitle: { color: '#25332A', fontSize: 13, fontWeight: '700' },
  categoryText: { color: '#89958E', fontSize: 10, marginTop: 5 },
  transactionAmount: { color: '#25332A', fontSize: 13, fontWeight: '700' },
  deleteButton: { marginLeft: 10, padding: 4 },
  deleteText: { color: '#B42318', fontSize: 20, fontWeight: '700' },
  emptyState: { padding: 30, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 17 },
  emptyText: { color: '#89958E', fontSize: 13 },
  footer: { color: '#A0AAA3', fontSize: 11, textAlign: 'center', marginTop: 25 },
});
