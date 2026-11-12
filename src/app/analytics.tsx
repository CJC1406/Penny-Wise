import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { getTransactions } from '@/services/api';
import { useFocusEffect } from 'expo-router';

const money = (value: number) =>
  '₹' + value.toLocaleString('en-IN');

export default function AnalyticsScreen() {
  const [expenses, setExpenses] = React.useState<{name: string; amount: number; color: string}[]>([]);
  const [income, setIncome] = React.useState(0);
  const refreshAnalytics = React.useCallback(() => {
    getTransactions().then((items) => {
      setIncome(items.filter((x) => x.TransactionType === 'INCOME').reduce((s, x) => s + Number(x.Amount), 0));
      setExpenses(items.filter((x) => x.TransactionType === 'EXPENSE').map((x) => ({ name: x.Description || 'Expense', amount: Number(x.Amount), color: '#268653' })));
    }).catch(() => undefined);
  }, []);
  useFocusEffect(React.useCallback(() => { refreshAnalytics(); }, [refreshAnalytics]));
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
  const savings = income - totalExpenses;
  const largestExpense = expenses.reduce<{name: string; amount: number} | null>((largest, item) => !largest || item.amount > largest.amount ? item : largest, null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F7F5' }} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Analytics</Text>
      <Text style={styles.subtitle}>Understand your financial habits</Text>

      <View style={styles.period}>
        <Text style={styles.periodText}>NOVEMBER 2026</Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.cardLabel}>TOTAL SAVINGS</Text>
        <Text style={styles.savings}>{money(savings)}</Text>
        <Text style={styles.savingsNote}>Income minus expenses</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Income</Text>
          <Text style={styles.income}>{money(income)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Expenses</Text>
          <Text style={styles.expense}>{money(totalExpenses)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Expense breakdown</Text>
        <Text style={styles.sectionSubtitle}>Spending by category</Text>

        {expenses.map(item => {
          const percentage = (item.amount / totalExpenses) * 100;

          return (
            <View key={item.name} style={styles.expenseItem}>
              <View style={styles.expenseTop}>
                <View style={styles.nameRow}>
                  <View style={[styles.dot, { backgroundColor: item.color }]} />
                  <Text style={styles.categoryName}>{item.name}</Text>
                </View>
                <Text style={styles.categoryAmount}>{money(item.amount)}</Text>
              </View>

              <View style={styles.barBackground}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${percentage}%`,
                      backgroundColor: item.color,
                    },
                  ]}
                />
              </View>

              <Text style={styles.percentage}>
                {percentage.toFixed(1)}% of expenses
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Financial overview</Text>

        <View style={styles.overviewRow}>
          <Text style={styles.overviewLabel}>Savings rate</Text>
          <Text style={styles.overviewValue}>
            {income > 0 ? ((savings / income) * 100).toFixed(1) : '0.0'}%
          </Text>
        </View>

        <View style={styles.overviewRow}>
          <Text style={styles.overviewLabel}>Largest expense</Text>
          <Text style={styles.overviewValue}>
            {largestExpense?.name || 'No expenses'}
          </Text>
        </View>

        <View style={styles.overviewRow}>
          <Text style={styles.overviewLabel}>Number of categories</Text>
          <Text style={styles.overviewValue}>{expenses.length}</Text>
        </View>
      </View>

      <Text style={styles.footer}>Live analytics from your recorded transactions</Text>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7F5' },
  content: { padding: 20, paddingTop: 22, paddingBottom: 35 },
  heading: { fontSize: 26, fontWeight: '800', color: '#25332A' },
  subtitle: { fontSize: 12, color: '#89958E', marginTop: 5 },
  period: {
    alignSelf: 'flex-start',
    backgroundColor: '#E6EFE8',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 20,
    marginBottom: 17,
  },
  periodText: { color: '#176B45', fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  summaryCard: { backgroundColor: '#176B45', borderRadius: 20, padding: 22 },
  cardLabel: { color: '#D6E9DC', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  savings: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', marginTop: 12 },
  savingsNote: { color: '#D6E9DC', fontSize: 11, marginTop: 7 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 15, padding: 16 },
  statLabel: { color: '#89958E', fontSize: 11 },
  income: { color: '#268653', fontSize: 17, fontWeight: '800', marginTop: 9 },
  expense: { color: '#D47777', fontSize: 17, fontWeight: '800', marginTop: 9 },
  section: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginTop: 18 },
  sectionTitle: { color: '#25332A', fontSize: 16, fontWeight: '800' },
  sectionSubtitle: { color: '#89958E', fontSize: 11, marginTop: 5, marginBottom: 18 },
  expenseItem: { marginBottom: 17 },
  expenseTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  categoryName: { color: '#526158', fontSize: 12, fontWeight: '600' },
  categoryAmount: { color: '#25332A', fontSize: 12, fontWeight: '700' },
  barBackground: { height: 8, borderRadius: 5, backgroundColor: '#EDF1ED', overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 5 },
  percentage: { color: '#89958E', fontSize: 10, marginTop: 6 },
  overviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#EFF2EF' },
  overviewLabel: { color: '#68766D', fontSize: 12 },
  overviewValue: { color: '#25332A', fontSize: 12, fontWeight: '700' },
  footer: { color: '#A0AAA3', fontSize: 10, textAlign: 'center', marginTop: 22 },
});

