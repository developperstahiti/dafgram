'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  useTheme,
  alpha,
  Skeleton,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalanceWallet as WalletIcon,
  Savings as SavingsIcon,
} from '@mui/icons-material';
import { budgetCategoriesAPI, BudgetSummary, BudgetCategory, savingsCategoriesAPI, SavingsCategorySummary, bankAPI, Category, transactionsAPI } from '@/lib/api';
import { useCompanyStore } from '@/store/companyStore';
import { formatCurrency } from '@/lib/currency';

interface Props {
  currentDate: Date;
}

export default function PersonalExpenseSummary({ currentDate }: Props) {
  const theme = useTheme();
  const { currentCompany } = useCompanyStore();
  const currency = currentCompany?.currency || 'EUR';

  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [savingsSummary, setSavingsSummary] = useState<SavingsCategorySummary | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [spendingByCategory, setSpendingByCategory] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const formatAmount = useCallback(
    (value: number) => formatCurrency(value, currency),
    [currency]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const [budgetRes, savingsRes, catRes, txRes] = await Promise.all([
        budgetCategoriesAPI.getSummary(month, year),
        savingsCategoriesAPI.getSummary(month, year),
        bankAPI.getCategories(),
        transactionsAPI.getAll({ type: 'expense', start_date: startDate, end_date: endDate, limit: 500 }),
      ]);
      setSummary(budgetRes.data);
      setSavingsSummary(savingsRes.data);
      setAllCategories(catRes.data);
      // Calculer les dépenses par catégorie
      const byCategory: Record<number, number> = {};
      for (const tx of txRes.data.items || []) {
        if (tx.category_id) {
          byCategory[tx.category_id] = (byCategory[tx.category_id] || 0) + tx.amount;
        }
      }
      setSpendingByCategory(byCategory);
    } catch (err) {
      console.error('Error fetching personal summary:', err);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Écouter les événements de rafraîchissement
  useEffect(() => {
    const handleRefresh = () => fetchData();
    window.addEventListener('refresh-budget-data', handleRefresh);
    window.addEventListener('refresh-savings-data', handleRefresh);
    return () => {
      window.removeEventListener('refresh-budget-data', handleRefresh);
      window.removeEventListener('refresh-savings-data', handleRefresh);
    };
  }, [fetchData]);

  if (loading) {
    return (
      <Box sx={{ mt: 3 }}>
        <Card sx={{ borderRadius: 2, bgcolor: theme.palette.background.paper }}>
          <CardContent sx={{ p: 2.5 }}>
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
          </CardContent>
        </Card>
      </Box>
    );
  }

  const totalRevenue = summary?.total_revenue || 0;
  const totalSpent = summary?.total_expenses || 0;
  const remaining = totalRevenue - totalSpent;
  const savingsPercentage = savingsSummary?.total_savings_percentage || 0;
  const savingsAllocated = (savingsPercentage / 100) * totalRevenue;
  const savingsSpent = savingsSummary?.current_month_spent || 0;

  // Build category rows from budget categories (non-savings, parents only)
  const expenseCategories = (summary?.categories || []).filter(
    c => !c.is_savings && c.category && !c.category.parent_id
  );

  // Sous-catégories par parent
  const getSubcategories = (parentCategoryId: number) =>
    allCategories.filter(c => c.parent_id === parentCategoryId && c.type === 'expense');

  // Savings row
  const savingsRow = {
    name: 'Épargne',
    color: '#10B981',
    allocated: savingsAllocated,
    spent: savingsSpent,
    percentage: savingsPercentage,
    subcategories: [] as { name: string; color: string; spent: number }[],
  };

  const rows = [
    ...expenseCategories.map(c => {
      const subs = c.category_id ? getSubcategories(c.category_id) : [];
      return {
        name: c.category?.name || 'Catégorie',
        color: c.category?.color || '#6B7280',
        allocated: c.allocated_amount,
        spent: c.spent_amount,
        percentage: c.percentage,
        subcategories: subs.map(sub => ({
          name: sub.name,
          color: sub.color,
          spent: spendingByCategory[sub.id] || 0,
        })),
      };
    }),
    savingsRow,
  ];

  return (
    <Box sx={{ mt: 3 }}>
      <Card sx={{ borderRadius: 2, bgcolor: theme.palette.background.paper }}>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary, mb: 2.5 }}>
            Suivi des dépenses
          </Typography>

          {/* Summary cards */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            {/* Revenus */}
            <Box
              sx={{
                flex: 1,
                minWidth: { xs: '45%', sm: 140 },
                p: 2,
                borderRadius: 2,
                bgcolor: alpha('#10B981', 0.08),
                border: `1px solid ${alpha('#10B981', 0.2)}`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <TrendingUpIcon sx={{ fontSize: 16, color: '#10B981' }} />
                <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 600 }}>
                  Revenus
                </Typography>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                {formatAmount(totalRevenue)}
              </Typography>
            </Box>

            {/* Dépenses */}
            <Box
              sx={{
                flex: 1,
                minWidth: { xs: '45%', sm: 140 },
                p: 2,
                borderRadius: 2,
                bgcolor: alpha('#EF4444', 0.08),
                border: `1px solid ${alpha('#EF4444', 0.2)}`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <TrendingDownIcon sx={{ fontSize: 16, color: '#EF4444' }} />
                <Typography variant="caption" sx={{ color: '#EF4444', fontWeight: 600 }}>
                  Dépenses
                </Typography>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                {formatAmount(totalSpent)}
              </Typography>
            </Box>

            {/* Reste disponible */}
            <Box
              sx={{
                flex: 1,
                minWidth: { xs: '45%', sm: 140 },
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(remaining >= 0 ? '#F5C518' : '#EF4444', 0.08),
                border: `1px solid ${alpha(remaining >= 0 ? '#F5C518' : '#EF4444', 0.2)}`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <WalletIcon sx={{ fontSize: 16, color: remaining >= 0 ? '#F5C518' : '#EF4444' }} />
                <Typography variant="caption" sx={{ color: remaining >= 0 ? '#F5C518' : '#EF4444', fontWeight: 600 }}>
                  Reste disponible
                </Typography>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                {formatAmount(remaining)}
              </Typography>
            </Box>
          </Box>

          {/* Category breakdown */}
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: theme.palette.text.secondary, mb: 1.5 }}>
            Répartition du budget (règle 50/30/20)
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {rows.map((row) => {
              const usedPercent = row.allocated > 0
                ? Math.min(100, (row.spent / row.allocated) * 100)
                : 0;
              const isOver = row.spent > row.allocated && row.allocated > 0;

              return (
                <Box key={row.name}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: row.color }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                        {row.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: isOver ? '#EF4444' : theme.palette.text.secondary }}>
                        ({Math.round(usedPercent)}% utilisé)
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: isOver ? '#EF4444' : theme.palette.text.primary,
                      }}
                    >
                      {formatAmount(row.spent)} / {formatAmount(row.allocated)}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={usedPercent}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: alpha(row.color, 0.15),
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                        bgcolor: isOver ? '#EF4444' : row.color,
                      },
                    }}
                  />
                  {/* Sous-catégories */}
                  {row.subcategories.length > 0 && (
                    <Box sx={{ pl: 3, mt: 1, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                      {row.subcategories.filter(sub => sub.spent > 0).map(sub => {
                        const subPercent = row.spent > 0 ? (sub.spent / row.spent) * 100 : 0;
                        return (
                          <Box key={sub.name}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.3 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: sub.color }} />
                                <Typography variant="caption" sx={{ fontWeight: 500, color: theme.palette.text.secondary }}>
                                  {sub.name}
                                </Typography>
                              </Box>
                              <Typography variant="caption" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                                {formatAmount(sub.spent)}
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(100, subPercent)}
                              sx={{
                                height: 4,
                                borderRadius: 2,
                                bgcolor: alpha(sub.color, 0.1),
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 2,
                                  bgcolor: sub.color,
                                },
                              }}
                            />
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>

        </CardContent>
      </Card>
    </Box>
  );
}
