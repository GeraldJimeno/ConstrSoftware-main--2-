export async function getAnalystStats() {
  await new Promise((resolve) => setTimeout(resolve, 300))

  return {
    timeframe: {
      label: 'Últimos 6 meses',
      value: '6 meses',
    },
    totals: {
      analyzed: 1428,
      pending: 76,
      completed: 8921,
      rejected: 72,
    },
    summary: [
      {
        key: 'analyzed',
        label: 'Número de muestras analizadas',
        value: 1428,
        trend: 1.2,
      },
      {
        key: 'pending',
        label: 'Muestras pendientes de validación',
        value: 76,
        trend: 5.8,
      },
      {
        key: 'completed',
        label: 'Muestras completadas',
        value: 8921,
        trend: -0.5,
      },
      {
        key: 'rejected',
        label: 'Muestras rechazadas',
        value: 72,
        trend: -0.1,
      },
    ],
    series: [
      { label: 'Ene', value: 800 },
      { label: 'Feb', value: 1200 },
      { label: 'Mar', value: 1020 },
      { label: 'Abr', value: 1428 },
      { label: 'May', value: 980 },
      { label: 'Jun', value: 1260 },
    ],
  }
}
