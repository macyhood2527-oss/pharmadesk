export const formatDateOnly = (value, fallback = 'No expiry') => {
  if (!value) return fallback;

  const parts = String(value).split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts.map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleDateString();
};

export const parseDateOnlyToLocalTime = (value) => {
  if (!value) return null;
  const parts = String(value).split('-');
  if (parts.length !== 3) return new Date(value);

  const [year, month, day] = parts.map(Number);
  return new Date(year, month - 1, day);
};
