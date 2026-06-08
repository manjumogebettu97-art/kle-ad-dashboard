const DAY_MS = 24 * 60 * 60 * 1000;

function dateRange(start, end) {
  if (!start || !end) return [];
  const dates = [];
  let current = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current = new Date(current.getTime() + DAY_MS);
  }
  return dates;
}

function jitter(index, amount) {
  return Math.sin(index * 1.73) * amount + Math.cos(index * 0.91) * amount * 0.5;
}

function youtubeWeight(index, totalDays, metric) {
  const tailStart = Math.max(totalDays - 14, 0);

  if (index < 14) {
    return metric === 'view_rate' ? 0.05 : 0.03;
  }

  if (index < 18) {
    const ramp = [0.2, 0.55, 1.15, 1.38][index - 14];
    if (metric === 'views') return ramp * 1.2;
    if (metric === 'view_rate') return ramp * 1.45;
    return ramp;
  }

  if (index < 35) {
    const base = metric === 'views' ? 1.3 : metric === 'cost' ? 1.05 : 0.9;
    return Math.max(0.08, base + jitter(index, 0.08));
  }

  if (index < 54) {
    const slide = (index - 35) * 0.018;
    const base = metric === 'views' ? 1.12 : metric === 'cost' ? 0.95 : 0.86;
    return Math.max(0.08, base - slide + jitter(index, 0.045));
  }

  if (index < tailStart) {
    return Math.max(0.08, 0.72 + jitter(index, 0.035));
  }

  if (index < tailStart + 4) {
    const spike = [2.1, 2.35, 2.25, 1.85][index - tailStart];
    if (metric === 'view_rate') return spike * 1.15;
    return spike;
  }

  if (metric === 'view_rate') {
    return [0.05, 0.1, 0.75, 1.35, 0.7, 1.75, 1.85, 0.05, 0.9, 0.05][index - tailStart - 4] || 0.08;
  }

  return metric === 'cost' ? 0.025 : 0.04;
}

function distributeInteger(total, weights) {
  const target = Math.max(Math.round(Number(total || 0)), 0);
  const weightTotal = weights.reduce((sum, weight) => sum + Math.max(weight, 0), 0);
  if (!target || !weightTotal || !weights.length) return weights.map(() => 0);

  let roundedTotal = 0;
  let rawTotal = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return target - roundedTotal;
    rawTotal += target * Math.max(weight, 0) / weightTotal;
    const value = Math.max(Math.round(rawTotal - roundedTotal), 0);
    roundedTotal += value;
    return value;
  });
}

function distributeMoney(total, weights) {
  return distributeInteger(Math.round(Number(total || 0) * 100), weights)
    .map((cents) => Number((cents / 100).toFixed(2)));
}

function generateYoutubeDaily(period, totals) {
  const dates = dateRange(period.start_date, period.end_date);
  const costWeights = dates.map((_, index) => youtubeWeight(index, dates.length, 'cost'));
  const impressionWeights = dates.map((_, index) => youtubeWeight(index, dates.length, 'impressions'));
  const viewWeights = dates.map((_, index) => youtubeWeight(index, dates.length, 'views'));
  const clickWeights = dates.map((_, index) => youtubeWeight(index, dates.length, 'clicks'));

  const costs = distributeMoney(totals.cost, costWeights);
  const impressions = distributeInteger(totals.impressions, impressionWeights);
  const views = distributeInteger(totals.viewable_impressions, viewWeights);
  const clicks = distributeInteger(totals.clicks, clickWeights);

  return dates.map((date, index) => {
    const viewRate = impressions[index] ? views[index] * 100 / impressions[index] : 0;
    const cpc = clicks[index] ? costs[index] / clicks[index] : 0;
    const cpm = impressions[index] ? costs[index] * 1000 / impressions[index] : 0;
    const cpv = views[index] ? costs[index] / views[index] : 0;
    return {
      date,
      impressions: impressions[index],
      clicks: clicks[index],
      cost: costs[index],
      viewable_impressions: views[index],
      view_rate: Number(viewRate.toFixed(2)),
      avg_cpc: Number(cpc.toFixed(2)),
      avg_cpm: Number(cpm.toFixed(2)),
      avg_cpv: Number(cpv.toFixed(2)),
    };
  });
}

module.exports = { generateYoutubeDaily };
