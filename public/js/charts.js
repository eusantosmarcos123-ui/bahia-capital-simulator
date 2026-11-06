/**
 * Gerenciador de Gráficos com Chart.js — Bahia Capital Simulador
 */
const ChartsManager = {
  allocationChart: null,
  performanceChart: null,

  // Inicializa o Gráfico Donut de Alocação
  initAllocationChart(ctx, data) {
    if (this.allocationChart) {
      this.allocationChart.destroy();
    }

    const labels = ['Caixa (R$)', 'Ações & FIIs (B3)', 'Criptomoedas'];
    const values = [
      data.cashPercentage || 100,
      data.stocksPercentage || 0,
      data.cryptoPercentage || 0,
    ];

    this.allocationChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: [
              '#D4AF37', // Dourado Caixa
              '#2196F3', // Azul B3
              '#FF9800', // Laranja Cripto
            ],
            borderColor: '#0D1728',
            borderWidth: 3,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#8A99AD',
              font: { family: 'Plus Jakarta Sans', size: 12 },
              padding: 16,
              usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: '#0A1128',
            titleColor: '#D4AF37',
            bodyColor: '#F0F4F8',
            borderColor: '#1E2D4A',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: function (context) {
                return ` ${context.label}: ${context.raw}%`;
              },
            },
          },
        },
        cutout: '68%',
      },
    });
  },

  // Inicializa o Gráfico de Linha de Evolução Patrimonial
  initPerformanceChart(ctx, initialCapital, currentEquity) {
    if (this.performanceChart) {
      this.performanceChart.destroy();
    }

    const labels = ['Início (R$ 10k)', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'Atual'];
    
    // Simula curva de evolução patrimonial baseada no valor atual
    const step = (currentEquity - initialCapital) / 6;
    const dataPoints = [
      initialCapital,
      parseFloat((initialCapital + step * 0.8 + (Math.random() * 40 - 20)).toFixed(2)),
      parseFloat((initialCapital + step * 1.7 + (Math.random() * 50 - 25)).toFixed(2)),
      parseFloat((initialCapital + step * 2.9 + (Math.random() * 60 - 30)).toFixed(2)),
      parseFloat((initialCapital + step * 4.1 + (Math.random() * 40 - 20)).toFixed(2)),
      parseFloat((initialCapital + step * 5.2 + (Math.random() * 30 - 15)).toFixed(2)),
      currentEquity,
    ];

    const isProfit = currentEquity >= initialCapital;
    const strokeColor = isProfit ? '#00E676' : '#FF5252';

    this.performanceChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Patrimônio Total (R$)',
            data: dataPoints,
            borderColor: strokeColor,
            backgroundColor: isProfit ? 'rgba(0, 230, 118, 0.08)' : 'rgba(255, 82, 82, 0.08)',
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointBackgroundColor: strokeColor,
            pointBorderColor: '#0D1728',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0A1128',
            titleColor: '#D4AF37',
            bodyColor: '#F0F4F8',
            borderColor: '#1E2D4A',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: function (context) {
                return ` Patrimônio: R$ ${context.raw.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(30, 45, 74, 0.35)' },
            ticks: { color: '#8A99AD', font: { family: 'Plus Jakarta Sans', size: 11 } },
          },
          y: {
            grid: { color: 'rgba(30, 45, 74, 0.35)' },
            ticks: {
              color: '#8A99AD',
              font: { family: 'Plus Jakarta Sans', size: 11 },
              callback: function (val) {
                return 'R$ ' + val.toLocaleString('pt-BR');
              },
            },
          },
        },
      },
    });
  },
};
