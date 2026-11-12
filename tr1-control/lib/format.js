export const formatMoney = (amount) => {
  const num = Number(amount || 0);
  return num.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
};