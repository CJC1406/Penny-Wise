import { getSummary, getTransactions, getCurrentUser, type Transaction } from "@/services/api";
import React, { useEffect, useState } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();

  const [backendStatus, setBackendStatus] = useState("Checking...");
  const [summary, setSummary] = useState({ balance: 0, income: 0, expenses: 0, accounts: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [name, setName] = useState("there");

  const refreshDashboard = React.useCallback(() => {
    Promise.all([getSummary(), getTransactions(), getCurrentUser()]).then(([s, t, u]) => { setSummary(s); setTransactions(t); setName(u.FullName || u.Username); setBackendStatus("Connected"); }).catch(() => setBackendStatus("Disconnected"));
  }, []);
  useFocusEffect(React.useCallback(() => { refreshDashboard(); }, [refreshDashboard]));
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>GOOD MORNING</Text>
            <Text style={styles.username}>Hello, {name}</Text>
            <Text style={{ color: backendStatus === "Connected" ? "green" : "red" }}>
            Backend: {backendStatus}
            </Text>
          </View>
          <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel="Open profile">
            <Text style={styles.profileInitial}>{name.charAt(0).toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
          <Text style={styles.balanceAmount}>₹{Number(summary.balance).toLocaleString('en-IN', {minimumFractionDigits: 2})}</Text>
          <Text style={styles.balanceNote}>Across all your accounts</Text>

          <View style={styles.balanceDivider} />

          <View style={styles.balanceActions}>
            <View>
              <Text style={styles.whiteMuted}>INCOME</Text>
              <Text style={styles.balanceSmall}>+ ₹{Number(summary.income).toLocaleString('en-IN')}</Text>
            </View>
            <View>
              <Text style={styles.whiteMuted}>EXPENSES</Text>
              <Text style={styles.balanceSmall}>- ₹{Number(summary.expenses).toLocaleString('en-IN')}</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickActions}
        >
          <TouchableOpacity style={styles.actionItem}
              onPress={() => router.push('/explore?type=expense')}>
            <View style={styles.actionIcon}>
              <Text style={styles.actionSymbol}>+</Text>
            </View>
            <Text style={styles.actionText}>Add expense</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem}
              onPress={() => router.push('/explore?type=income')}>
            <View style={styles.actionIcon}>
              <Text style={styles.actionSymbol}>↗</Text>
            </View>
            <Text style={styles.actionText}>Add income</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem}
              onPress={() => router.push('/budgets')}>
            <View style={styles.actionIcon}>
              <Text style={styles.actionSymbol}>▤</Text>
            </View>
            <Text style={styles.actionText}>My budgets</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem}
              onPress={() => router.push('/analytics')}>
            <View style={styles.actionIcon}>
              <Text style={styles.actionSymbol}>⌁</Text>
            </View>
            <Text style={styles.actionText}>Analytics</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}
              onPress={() => router.push('/accounts')}>
            <View style={styles.actionIcon}>
              <Text style={styles.actionSymbol}>₹</Text>
            </View>
            <Text style={styles.actionText}>My accounts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}
              onPress={() => router.push('/profile')}>
            <View style={styles.actionIcon}>
              <Text style={styles.actionSymbol}>{name.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.actionText}>Profile</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Monthly Spending */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Monthly spending</Text>
          <Text style={styles.monthLabel}>November 2026</Text>
        </View>

        <View style={styles.spendingCard}>
          <View style={styles.spendingTop}>
            <View>
              <Text style={styles.mutedText}>Total spent</Text>
            <Text style={styles.spentAmount}>₹{Number(summary.expenses).toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.budgetBadge}>
              <Text style={styles.budgetBadgeText}>This month</Text>
            </View>
          </View>

          <View style={styles.progressBackground}>
            <View style={styles.progressFill} />
          </View>

          <View style={styles.budgetFooter}>
            <Text style={styles.mutedText}>{summary.accounts} accounts</Text>
            <Text style={styles.remainingText}>Live balance</Text>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent transactions</Text>
          <TouchableOpacity onPress={() => router.push('/explore')} accessibilityRole="button" accessibilityLabel="See all transactions">
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.transactionCard}>
          {transactions.slice(0, 5).map((item, index) => (
            <View
              key={item.TransactionID}
              style={[
                styles.transactionRow,
                index !== transactions.length - 1 && styles.transactionBorder,
              ]}
            >
              <View style={styles.transactionIcon}>
                <Text style={styles.transactionIconText}>{item.TransactionType === 'INCOME' ? 'I' : 'E'}</Text>
              </View>

              <View style={styles.transactionDetails}>
                <Text style={styles.transactionTitle}>{item.Description || item.TransactionType}</Text>
                <Text style={styles.transactionCategory}>
                  {item.TransactionType} · {item.TransactionDate ? new Date(item.TransactionDate).toLocaleDateString() : ''}
                </Text>
              </View>

              <Text
                style={[
                  styles.transactionAmount,
                  item.TransactionType === 'INCOME' && styles.incomeAmount,
                ]}
              >
                {item.TransactionType === 'INCOME' ? '+' : '-'} ₹{Number(item.Amount).toLocaleString('en-IN')}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.footerText}>PennyWise · Manage money wisely</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F9F7',
  },
  container: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 35,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  greeting: {
    color: '#84918A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  username: {
    color: '#18251E',
    fontSize: 25,
    fontWeight: '700',
    marginTop: 5,
  },
  profileButton: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: '#DDEDE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    color: '#167343',
    fontSize: 19,
    fontWeight: '700',
  },
  balanceCard: {
    backgroundColor: '#176B45',
    borderRadius: 23,
    padding: 23,
  },
  balanceLabel: {
    color: '#C4E3D1',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.3,
  },
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
    marginTop: 10,
  },
  balanceNote: {
    color: '#C4E3D1',
    fontSize: 12,
    marginTop: 5,
  },
  balanceDivider: {
    height: 1,
    backgroundColor: '#FFFFFF35',
    marginVertical: 22,
  },
  balanceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  whiteMuted: {
    color: '#C4E3D1',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  balanceSmall: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    marginTop: 7,
  },
  quickActions: {
    gap: 14,
    marginTop: 27,
    marginBottom: 30,
    paddingRight: 18,
  },
  actionItem: {
    alignItems: 'center',
    width: 76,
  },
  actionIcon: {
    width: 53,
    height: 53,
    borderRadius: 17,
    backgroundColor: '#E7F1EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionSymbol: {
    color: '#176B45',
    fontSize: 25,
    fontWeight: '600',
  },
  actionText: {
    color: '#45534A',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 9,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 13,
  },
  sectionTitle: {
    color: '#18251E',
    fontSize: 18,
    fontWeight: '700',
  },
  monthLabel: {
    color: '#84918A',
    fontSize: 11,
  },
  spendingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 19,
    marginBottom: 28,
  },
  spendingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mutedText: {
    color: '#89958E',
    fontSize: 12,
  },
  spentAmount: {
    color: '#18251E',
    fontSize: 25,
    fontWeight: '700',
    marginTop: 5,
  },
  budgetBadge: {
    backgroundColor: '#E7F3EA',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  budgetBadgeText: {
    color: '#176B45',
    fontSize: 11,
    fontWeight: '700',
  },
  progressBackground: {
    height: 8,
    backgroundColor: '#E9EFEA',
    borderRadius: 10,
    marginTop: 20,
    overflow: 'hidden',
  },
  progressFill: {
    width: '22%',
    height: '100%',
    backgroundColor: '#2A9D65',
    borderRadius: 10,
  },
  budgetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  remainingText: {
    color: '#176B45',
    fontSize: 11,
    fontWeight: '700',
  },
  seeAll: {
    color: '#176B45',
    fontSize: 12,
    fontWeight: '700',
  },
  transactionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    paddingHorizontal: 16,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  transactionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F0',
  },
  transactionIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#EAF2EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionIconText: {
    color: '#176B45',
    fontSize: 17,
    fontWeight: '700',
  },
  transactionDetails: {
    flex: 1,
    marginLeft: 12,
  },
  transactionTitle: {
    color: '#25332A',
    fontSize: 13,
    fontWeight: '700',
  },
  transactionCategory: {
    color: '#89958E',
    fontSize: 10,
    marginTop: 5,
  },
  transactionAmount: {
    color: '#25332A',
    fontSize: 13,
    fontWeight: '700',
  },
  incomeAmount: {
    color: '#23935A',
  },
  footerText: {
    textAlign: 'center',
    color: '#A0AAA3',
    fontSize: 10,
    marginTop: 27,
  },
});
