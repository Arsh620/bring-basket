const AppError = require('../../utils/AppError');

const TIME_ZONE = 'Asia/Kolkata';
const INDIA_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

const datePartsInIndia = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts
    .filter((part) => part.type !== 'literal')
    .map(({ type, value }) => [type, Number(value)]));
};

const indiaMidnight = (year, month, day) => new Date(
  Date.UTC(year, month - 1, day) - INDIA_OFFSET_MS,
);

const dateKey = (year, month, day) => [
  String(year).padStart(4, '0'),
  String(month).padStart(2, '0'),
  String(day).padStart(2, '0'),
].join('-');

const formatLabel = (key, period) => {
  const date = new Date(`${period === 'this_year' ? `${key}-01` : key}T00:00:00Z`);
  return new Intl.DateTimeFormat('en', {
    ...(period === 'this_week' ? { weekday: 'short' } : {}),
    ...(period === 'this_month' ? { day: 'numeric' } : {}),
    ...(period === 'this_year' ? { month: 'short' } : {}),
    timeZone: 'UTC',
  }).format(date);
};

const getDashboardPeriod = (period, now = new Date()) => {
  if (!['this_week', 'this_month', 'this_year'].includes(period)) {
    throw new AppError('period must be this_week, this_month, or this_year', 400);
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new AppError('A valid dashboard date is required', 400);
  }

  const { year, month, day } = datePartsInIndia(now);
  let startDate = new Date(Date.UTC(year, month - 1, day));
  let endDate;
  let bucketFormat;
  let bucketDates = [];

  if (period === 'this_week') {
    const daysSinceMonday = (startDate.getUTCDay() + 6) % 7;
    startDate.setUTCDate(startDate.getUTCDate() - daysSinceMonday);
    endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 7);
    bucketFormat = '%Y-%m-%d';
    bucketDates = Array.from({ length: 7 }, (_, index) => {
      const current = new Date(startDate);
      current.setUTCDate(current.getUTCDate() + index);
      return dateKey(current.getUTCFullYear(), current.getUTCMonth() + 1, current.getUTCDate());
    });
  } else if (period === 'this_month') {
    startDate.setUTCDate(1);
    endDate = new Date(Date.UTC(year, month, 1));
    bucketFormat = '%Y-%m-%d';
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    bucketDates = Array.from({ length: daysInMonth }, (_, index) => (
      dateKey(year, month, index + 1)
    ));
  } else {
    startDate = new Date(Date.UTC(year, 0, 1));
    endDate = new Date(Date.UTC(year + 1, 0, 1));
    bucketFormat = '%Y-%m';
    bucketDates = Array.from({ length: 12 }, (_, index) => (
      `${String(year).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}`
    ));
  }

  const buckets = bucketDates.map((key) => ({ key, label: formatLabel(key, period) }));
  return {
    period,
    start: indiaMidnight(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, startDate.getUTCDate()),
    end: new Date(indiaMidnight(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, endDate.getUTCDate()).getTime() - 1),
    bucketFormat,
    buckets,
  };
};

module.exports = { getDashboardPeriod, TIME_ZONE };
