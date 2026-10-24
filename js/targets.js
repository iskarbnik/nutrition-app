// יעדים יומיים: קלוריות, חלבון, שומן, פחמימות וסיבים
(function (root) {
  const DEFICIT = 500;
  const FLOOR = { female: 1200, male: 1500 };
  const PROTEIN_PER_KG = 1.6;
  const FAT_SHARE = 0.27;
  const FIBER = 25;

  const round10 = n => Math.round(n / 10) * 10;

  function bmrOf(sex, age, height, weight, fatPct) {
    // Katch-McArdle כשיש אחוז שומן, אחרת Mifflin-St Jeor
    if (fatPct != null) return 370 + 21.6 * weight * (1 - fatPct / 100);
    return 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161);
  }

  /**
   * profile: { sex, birthYear, height, activity, overrides? }
   * latest: { weight, fat? } — המדידה האחרונה
   * מחזיר null כשחסרים נתונים
   */
  function compute(profile, latest, onDate) {
    const { sex, birthYear, height, activity } = profile || {};
    if (!sex || !birthYear || !height || !latest || !latest.weight) return null;

    const age = Number(onDate.slice(0, 4)) - birthYear;
    const weight = latest.weight;
    const bmr = bmrOf(sex, age, height, weight, latest.fat);
    const tdee = bmr * (activity || 1.2);

    const o = profile.overrides || {};
    const auto = round10(tdee - DEFICIT);
    const floored = auto < FLOOR[sex];
    const kcal = o.kcal ?? (floored ? FLOOR[sex] : auto);
    const protein = o.protein ?? Math.round(PROTEIN_PER_KG * weight);
    const fat = o.fat ?? Math.round(kcal * FAT_SHARE / 9);
    const carbs = o.carbs ?? Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));

    return { bmr, tdee, kcal, protein, fat, carbs, fiber: FIBER, floored: o.kcal == null && floored };
  }

  const Targets = { compute };
  if (typeof module !== 'undefined') module.exports = Targets;
  else root.Targets = Targets;
})(this);
