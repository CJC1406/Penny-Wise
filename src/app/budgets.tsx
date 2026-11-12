import React, { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { createBudget, createCategory, deleteBudget, getBudgets, getCategories } from '@/services/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';

type Budget = {
  id: number;
  category: string;
  limit: number;
  spent: number;
};

const categories = [
  'Food',
  'Transport',
  'Shopping',
  'Education',
  'Entertainment',
  'Utilities',
  'Health',
  'Other',
];

export default function BudgetsScreen() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState('Food');
  const [limit, setLimit] = useState('');
  const [categoryIds, setCategoryIds] = useState<Record<string, number>>({});

  const loadBudgets = React.useCallback(() => Promise.all([getBudgets(), getCategories()]).then(([items, cats]: [any[], any[]]) => {
    setCategoryIds(Object.fromEntries(cats.filter((c) => c.CategoryType === 'EXPENSE').map((c) => [c.CategoryName, c.CategoryID])));
    setBudgets(items.map((b) => ({ id: b.BudgetID, category: b.CategoryName || String(b.CategoryID), limit: Number(b.BudgetAmount), spent: Number(b.Spent || 0) })));
  }).catch(() => undefined), []);
  React.useEffect(() => { loadBudgets(); }, [loadBudgets]);

  const totals = useMemo(() => {
    const budgeted = budgets.reduce((sum, item) => sum + item.limit, 0);
    const spent = budgets.reduce((sum, item) => sum + item.spent, 0);

    return {
      budgeted,
      spent,
      remaining: budgeted - spent,
    };
  }, [budgets]);

  const formatMoney = (amount: number) =>
    '₹' + amount.toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    });

  const addBudget = async () => {
    const amount = Number(limit);

    if (!limit.trim() || !Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a budget greater than zero.');
      return;
    }

    if (budgets.some((item) => item.category === category)) {
      Alert.alert(
        'Category already exists',
        'A budget for this category already exists.'
      );
      return;
    }

    let categoryId = categoryIds[category];
    if (!categoryId) {
      try {
        const created: any = await createCategory({ CategoryName: category, CategoryType: 'EXPENSE' });
        categoryId = created.CategoryID;
        setCategoryIds((current) => ({ ...current, [category]: categoryId! }));
      } catch (e) {
        Alert.alert('Category unavailable', e instanceof Error ? e.message : 'Unable to create the expense category.');
        return;
      }
    }
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    createBudget({ CategoryID: categoryId, BudgetAmount: amount, BudgetPeriod: 'MONTHLY', StartDate: start, EndDate: end }).then((b: any) => setBudgets(current => [...current, { id: b.BudgetID, category, limit: amount, spent: 0 }])).catch((e) => Alert.alert('Error', e.message));

    setLimit('');
    setCategory('Food');
    setShowForm(false);
  };

  const removeBudget = (id: number) => {
    Alert.alert('Remove budget?', 'This budget will be removed from this screen.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          deleteBudget(id).then(() => setBudgets((current) => current.filter((item) => item.id !== id))).catch((e) => Alert.alert('Error', e.message)),
      },
    ]);
  };

  const progressColor = (percentage: number) =>
    percentage >= 100 ? '#D9534F' : percentage >= 75 ? '#D69A36' : '#268653';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F7F5' }} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>My Budgets</Text>
          <Text style={styles.subtitle}>Plan your spending and stay on track</Text>
        </View>
        <TouchableOpacity style={styles.avatar} onPress={() => router.push('/notifications')}>
          <Text style={styles.avatarText}>🔔</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>TOTAL MONTHLY BUDGET</Text>
        <Text style={styles.summaryAmount}>{formatMoney(totals.budgeted)}</Text>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.smallLabel}>Spent</Text>
            <Text style={styles.summaryValue}>{formatMoney(totals.spent)}</Text>
          </View>
          <View>
            <Text style={styles.smallLabel}>Remaining</Text>
            <Text style={styles.summaryValue}>{formatMoney(totals.remaining)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Category budgets</Text>
        <Text style={styles.count}>{budgets.length} categories</Text>
      </View>

      {budgets.map((item) => {
        const percentage =
          item.limit > 0 ? (item.spent / item.limit) * 100 : 0;
        const cappedPercentage = Math.min(percentage, 100);
        const color = progressColor(percentage);

        return (
          <View style={styles.budgetCard} key={item.id}>
            <View style={styles.budgetTop}>
              <View style={styles.categoryIcon}>
                <Text style={styles.categoryIconText}>
                  {item.category.charAt(0)}
                </Text>
              </View>

              <View style={styles.categoryDetails}>
                <Text style={styles.categoryName}>{item.category}</Text>
                <Text style={styles.categorySubtitle}>Monthly budget</Text>
              </View>

              <TouchableOpacity onPress={() => removeBudget(item.id)}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.amountRow}>
              <Text style={styles.spentAmount}>{formatMoney(item.spent)}</Text>
              <Text style={styles.limitAmount}>of {formatMoney(item.limit)}</Text>
            </View>

            <View style={styles.progressBackground}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${cappedPercentage}%`,
                    backgroundColor: color,
                  },
                ]}
              />
            </View>

            <View style={styles.progressFooter}>
              <Text style={[styles.percentage, { color }]}>
                {Math.round(percentage)}% used
              </Text>
              <Text style={styles.remainingText}>
                {item.limit - item.spent >= 0
                  ? `${formatMoney(item.limit - item.spent)} left`
                  : `${formatMoney(item.spent - item.limit)} over budget`}
              </Text>
            </View>
          </View>
        );
      })}

      {showForm && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>Create a budget</Text>

          <Text style={styles.fieldLabel}>Choose category</Text>
          <View style={styles.categoryGrid}>
            {categories.map((item) => (
              <TouchableOpacity
                key={item}
                disabled={budgets.some((budget) => budget.category === item)}
                style={[
                  styles.categoryButton,
                  category === item && styles.categorySelected,
                  budgets.some((budget) => budget.category === item) &&
                    styles.categoryDisabled,
                ]}
                onPress={() => setCategory(item)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    category === item && styles.categorySelectedText,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Monthly limit (₹)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter budget amount"
            placeholderTextColor="#A0AAA3"
            keyboardType="decimal-pad"
            value={limit}
            onChangeText={setLimit}
          />

          <TouchableOpacity style={styles.saveButton} onPress={addBudget}>
            <Text style={styles.saveText}>Save budget</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setShowForm(false)}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowForm(!showForm)}
      >
        <Text style={styles.addButtonText}>
          {showForm ? 'Close form' : '+ Create budget'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.footer}>PennyWise • Spend with purpose</Text>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7F5' },
  content: { padding: 20, paddingTop: 55, paddingBottom: 35 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  heading: { fontSize: 25, fontWeight: '800', color: '#25332A' },
  subtitle: { fontSize: 12, color: '#89958E', marginTop: 5 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DCEBE0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#176B45', fontSize: 17, fontWeight: '800' },
  summaryCard: {
    backgroundColor: '#176B45',
    borderRadius: 21,
    padding: 22,
    marginBottom: 28,
  },
  summaryLabel: {
    color: '#D6E9DC',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  summaryAmount: {
    color: '#FFFFFF',
    fontSize: 29,
    fontWeight: '800',
    marginTop: 12,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#579473',
    marginVertical: 19,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  smallLabel: { color: '#D6E9DC', fontSize: 11 },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { color: '#25332A', fontSize: 17, fontWeight: '800' },
  count: { color: '#89958E', fontSize: 11 },
  budgetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 16,
    marginBottom: 12,
  },
  budgetTop: { flexDirection: 'row', alignItems: 'center' },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#EAF2EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryIconText: { color: '#176B45', fontSize: 16, fontWeight: '800' },
  categoryDetails: { flex: 1, marginLeft: 11 },
  categoryName: { color: '#25332A', fontSize: 13, fontWeight: '700' },
  categorySubtitle: { color: '#89958E', fontSize: 10, marginTop: 4 },
  removeText: { color: '#B45B55', fontSize: 10, fontWeight: '600' },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 17,
    marginBottom: 10,
  },
  spentAmount: { color: '#25332A', fontSize: 16, fontWeight: '800' },
  limitAmount: { color: '#89958E', fontSize: 11, marginLeft: 5 },
  progressBackground: {
    height: 8,
    borderRadius: 5,
    backgroundColor: '#E9EEEA',
    overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 5 },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 9,
  },
  percentage: { fontSize: 10, fontWeight: '700' },
  remainingText: { color: '#89958E', fontSize: 10 },
  addButton: {
    backgroundColor: '#176B45',
    padding: 16,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  addButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginTop: 12,
  },
  formTitle: {
    color: '#25332A',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  fieldLabel: {
    color: '#526158',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 9,
    marginTop: 12,
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryButton: {
    backgroundColor: '#F0F4F0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  categorySelected: { backgroundColor: '#DCEBE0' },
  categoryDisabled: { opacity: 0.35 },
  categoryButtonText: { color: '#68766D', fontSize: 11, fontWeight: '600' },
  categorySelectedText: { color: '#176B45', fontWeight: '800' },
  input: {
    backgroundColor: '#F5F7F5',
    borderRadius: 11,
    padding: 13,
    color: '#25332A',
    fontSize: 13,
  },
  saveButton: {
    backgroundColor: '#176B45',
    padding: 14,
    borderRadius: 11,
    alignItems: 'center',
    marginTop: 20,
  },
  saveText: { color: '#FFFFFF', fontWeight: '700' },
  cancelButton: { padding: 12, alignItems: 'center' },
  cancelText: { color: '#68766D', fontSize: 13, fontWeight: '600' },
  footer: {
    color: '#A0AAA3',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 25,
  },
});
