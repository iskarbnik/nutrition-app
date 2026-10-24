// יומן יומי: ארוחות, מים, קפה וצעדים, וסיכומים
(function (root) {
  const MEALS = ['breakfast', 'lunch', 'dinner', 'snacks'];
  const NUTRIENTS = ['kcal', 'protein', 'fat', 'carbs', 'fiber', 'sugar', 'sodium'];
  const RECENT_MAX = 20;

  const round1 = n => Math.round(n * 10) / 10;
  const copy = o => JSON.parse(JSON.stringify(o));

  function get(state, date) {
    if (!state.days[date]) {
      state.days[date] = { meals: { breakfast: [], lunch: [], dinner: [], snacks: [] }, water: 0, coffee: [], steps: null };
    }
    return state.days[date];
  }

  const addItems = (state, date, meal, items) => { get(state, date).meals[meal].push(...copy(items)); };
  const updateItem = (state, date, meal, index, patch) => {
    const list = get(state, date).meals[meal];
    list[index] = { ...list[index], ...patch };
  };
  const removeItem = (state, date, meal, index) => { get(state, date).meals[meal].splice(index, 1); };

  function addWater(state, date, liters) {
    const day = get(state, date);
    day.water = Math.max(0, Math.round(((day.water || 0) + liters) * 100) / 100);
  }
  const addCoffee = (state, date, typeId) => { get(state, date).coffee.push(typeId); };
  const removeCoffee = (state, date, index) => { get(state, date).coffee.splice(index, 1); };
  const setSteps = (state, date, n) => { get(state, date).steps = n; };

  // קריאה בלבד: לא יוצר יום ריק
  function totals(state, date) {
    const t = { byMeal: {} };
    for (const k of NUTRIENTS) t[k] = 0;
    const day = state.days[date];
    const add = x => { for (const k of NUTRIENTS) t[k] += Number(x[k]) || 0; };
    for (const meal of MEALS) {
      const items = day ? day.meals[meal] : [];
      t.byMeal[meal] = round1(items.reduce((s, x) => s + (Number(x.kcal) || 0), 0));
      items.forEach(add);
    }
    for (const id of (day ? day.coffee : [])) {
      const type = state.coffeeTypes.find(c => c.id === id);
      if (type) add(type);
    }
    for (const k of NUTRIENTS) t[k] = round1(t[k]);
    return t;
  }

  function remaining(targets, tot) {
    const r = {};
    for (const k of ['kcal', 'protein', 'fat', 'carbs']) r[k] = round1(targets[k] - tot[k]);
    r.over = r.kcal < 0;
    return r;
  }

  function saveMeal(state, name, items) {
    state.savedMeals.push({ id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, items: copy(items) });
  }

  function pushRecent(state, items) {
    for (const it of copy(items)) {
      state.recentItems = [it, ...state.recentItems.filter(x => x.name !== it.name)];
    }
    state.recentItems = state.recentItems.slice(0, RECENT_MAX);
  }

  // הארוחה שמוצעת לפי השעה
  function defaultMeal(hour) {
    if (hour >= 5 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 16) return 'lunch';
    if (hour >= 16 && hour < 21) return 'dinner';
    return 'snacks';
  }

  // שינוי כמות: כל הערכים משתנים באותו יחס
  function scaleItem(item, grams) {
    const k = item.grams > 0 ? grams / item.grams : 1;
    const out = { ...item, grams };
    for (const key of NUTRIENTS) out[key] = round1((Number(item[key]) || 0) * k);
    return out;
  }

  const Days = { MEALS, defaultMeal, scaleItem, get, addItems, updateItem, removeItem, addWater, addCoffee, removeCoffee, setSteps, totals, remaining, saveMeal, pushRecent };
  if (typeof module !== 'undefined') module.exports = Days;
  else root.Days = Days;
})(this);
