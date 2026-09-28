const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createLoader } = require('./ts-loader.cjs');

// These tests never open the project's real data directory or contact external services.
process.env.CRAFTBASE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'craftbase-regression-'));
process.env.DATABASE_URL = '';
process.env.CRAFTBASE_SECRET = 'regression-only-secret-never-used-in-production';
process.env.TZ = 'Asia/Manila';
const load = createLoader();
const tests = [];
const test = (name, run) => tests.push({ name, run });
const { habitStreak, dateInZone } = load('src/lib/shared/habits.ts');
const { repairTemplateDoc } = load('src/lib/shared/templateRepairs.ts');
const { TEMPLATES } = load('src/lib/templates/index.ts');
const { sanitizeDoc } = load('src/lib/shared/doc.ts');
const { buildMobileFlow, freeChildBoxes } = load('src/lib/shared/layout.ts');
const { evaluate, interpolate } = load('src/lib/shared/expressions.ts');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

test('Philippine midnight produces a consistent calendar date and weekday', () => {
  const RealDate = Date;
  global.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : ['2026-09-28T00:30:00+08:00'])); }
  };
  try {
    assert.equal(evaluate('{{now.today}}', {}), '2026-09-28');
    assert.equal(evaluate('{{now.day}}', {}), 'Monday');
    assert.match(String(evaluate('{{now.date}}', {})), /28/);
    assert.equal(dateInZone(new Date(), 'Asia/Manila'), '2026-09-28');
  } finally { global.Date = RealDate; }
});

test('checkout totals use raw prices, quantity and the schema currency', () => {
  const ctx = { record: { Price: 28 }, components: { Qty: { value: '3' } }, formatRecordField: (_, value) => `PHP ${value.toFixed(2)}` };
  assert.equal(interpolate('{{record.Price | multiply:Qty.value | currency:record.Price}}', ctx), 'PHP 84.00');
  assert.equal(evaluate('{{record.Price | multiply:Qty.value}}', { ...ctx, components: { Qty: { value: 'invalid' } } }), '');
});

test('daily streak ignores duplicates, survives an unfinished day and resets after a missed day', () => {
  assert.equal(habitStreak(['2026-09-26', '2026-09-27', '2026-09-27'], 'Every day', '2026-09-28'), 2);
  assert.equal(habitStreak(['2026-09-26', '2026-09-28'], 'Every day', '2026-09-28'), 1);
  assert.equal(habitStreak(['2026-09-26'], 'Every day', '2026-09-28'), 0);
});
test('weekday streak skips weekends but requires consecutive weekdays', () => {
  assert.equal(habitStreak(['2026-09-24', '2026-09-25', '2026-09-28'], 'Weekdays', '2026-09-28'), 3);
  assert.equal(habitStreak(['2026-09-24', '2026-09-28'], 'Weekdays', '2026-09-28'), 1);
  assert.equal(habitStreak(['2026-09-25', '2026-09-26'], 'Weekdays', '2026-09-27'), 1);
});
test('three-per-week goals count completed weeks and ignore repeat taps', () => {
  const dates = ['2026-09-14', '2026-09-16', '2026-09-18', '2026-09-21', '2026-09-23', '2026-09-25', '2026-09-25'];
  assert.equal(habitStreak(dates, '3 times a week', '2026-09-28'), 2);
  assert.equal(habitStreak(dates, '3 times a week', '2026-10-05'), 0);
});

test('all bundled templates remain valid and compatibility repairs are idempotent', () => {
  for (const template of TEMPLATES) {
    const doc = template.build();
    const snapshot = JSON.stringify(doc);
    const next = repairTemplateDoc(doc, template.id);
    assert.equal(JSON.stringify(doc), snapshot, `${template.id}: repair must not mutate input`);
    assert.deepEqual(next, doc, `${template.id}: repair must be idempotent`);
    assert.doesNotThrow(() => sanitizeDoc(doc));
    for (const page of doc.pages) {
      for (const el of Object.values(page.elements)) {
        if (el.parentId) assert.ok(page.elements[el.parentId]?.childIds.includes(el.id));
      }
    }
  }
});
test('roadmap keeps each heading with its list and logos keep their icon position', () => {
  const doc = TEMPLATES.find((t) => t.id === 'feedback').build();
  const page = doc.pages.find((p) => p.path === 'roadmap');
  const lists = Object.values(page.elements).filter((e) => e.type === 'list');
  assert.equal(lists.length, 3);
  for (const list of lists) assert.equal(page.elements[list.parentId].childIds[1], list.id);
  for (const width of [280, 350, 728]) assert.ok(buildMobileFlow(page, null, 1280, width).length);
  const logo = Object.values(page.elements).find((e) => e.name === 'Logo');
  const child = page.elements[logo.childIds[0]];
  assert.deepEqual(freeChildBoxes(page, logo.id, 'mobile', 40).get(child.id), child.box);
});
test('repairs preserve customized copy and handmade mobile positions', () => {
  const original = load('src/lib/templates/community.ts').feedback.build();
  const page = original.pages.find((p) => p.path === 'roadmap');
  page.mobileCustom = true;
  assert.deepEqual(repairTemplateDoc(original, 'feedback').pages.find((p) => p.id === page.id), page);
  const survey = load('src/lib/templates/marketing.ts').survey.build();
  const copy = survey.pages.flatMap((p) => Object.values(p.elements)).find((e) => e.props.text?.includes('5 questions'));
  copy.props.text = 'My custom questionnaire';
  assert.equal(repairTemplateDoc(survey, 'survey').pages[0].elements[copy.id].props.text, copy.props.text);
});
test('store and coffee confirmation pages require submission references after sanitization', () => {
  for (const id of ['store', 'coffee']) {
    const doc = sanitizeDoc(TEMPLATES.find((t) => t.id === id).build());
    assert.ok(doc.pages.some((p) => p.confirmationVariable === 'orderRef'));
    assert.ok(doc.variables.some((v) => v.name === 'orderRef'));
  }
});
test('delivery icon resolves, submit buttons are native submit controls, unfinished buttons are disabled', () => {
  assert.equal(load('src/components/ui/Icon.tsx').iconExists('Truck'), true);
  const { RuntimeContext, createRuntimeStore } = load('src/components/runtime/store.ts');
  const { FormContext } = load('src/components/runtime/context.ts');
  const { ButtonEl } = load('src/components/runtime/elements/ButtonEl.tsx');
  const doc = TEMPLATES.find((t) => t.id === 'store').build();
  const store = createRuntimeStore({ mode: 'live', appId: 'test', appName: 'Test', doc });
  const button = { id: 'button', name: 'Send', type: 'button', box: { x: 0, y: 0, w: 100, h: 44 }, style: {}, props: { label: 'Send', submit: true } };
  const render = (form, el) => renderToStaticMarkup(React.createElement(RuntimeContext.Provider, { value: store }, React.createElement(FormContext.Provider, { value: form }, React.createElement(ButtonEl, { el, style: {}, setNode: () => {} }))));
  assert.match(render('form', button), /type="submit"/);
  assert.doesNotMatch(render('form', button), /disabled=/);
  assert.match(render(null, { ...button, props: { label: 'Unfinished' } }), /disabled=/);
});

test('server check-ins are atomic, scoped to their app and owner, and use local calendar dates', async () => {
  const { getStore } = load('src/lib/server/store/index.ts');
  const { createCollection, createRecord, checkInHabit, toRuntimeRecords } = load('src/lib/server/data.ts');
  const store = await getStore();
  for (const id of ['test-user', 'app-owner', 'someone-else']) await store.put('users', { id });
  const viewer = { user: { id: 'test-user' }, isAdmin: false, timeZone: 'Asia/Manila' };
  const access = { read: 'owner', create: 'users', update: 'owner', delete: 'owner', adjust: 'owner' };
  const habits = await createCollection('test-app', { name: 'Habits', access, fields: [{ name: 'Name', type: 'text' }, { name: 'Goal', type: 'select', options: ['Every day', 'Weekdays', '3 times a week'] }, { name: 'Streak', type: 'number', min: 0 }] });
  const checkins = await createCollection('test-app', { name: 'Check-ins', access, fields: [{ name: 'Habit', type: 'reference', refCollectionId: habits.id }, { name: 'Day', type: 'date' }] });
  await store.put('apps', { id: 'test-app', templateId: 'habits', ownerId: 'app-owner', published: { slug: 'test-app' } });
  const habit = await createRecord(habits, { Name: 'Test habit', Goal: 'Every day', Streak: 99 }, viewer);
  const results = await Promise.all(Array.from({ length: 8 }, () => checkInHabit('test-app', checkins.id, habit.id, 'Asia/Manila', viewer)));
  assert.equal(results.filter((r) => !r.alreadyDone).length, 1);
  assert.ok(results.every((r) => r.streak === 1));
  const records = await store.find('records', 'collectionId', checkins.id);
  assert.equal(records.length, 1);
  assert.equal(records[0].data[checkins.fields.find((f) => f.name === 'Day').id], dateInZone(new Date(), 'Asia/Manila'));
  await assert.rejects(checkInHabit('other-app', checkins.id, habit.id, 'UTC', viewer), /collection/);
  await assert.rejects(checkInHabit('test-app', checkins.id, habit.id, 'UTC', { ...viewer, user: { id: 'someone-else' } }), /own habits/);
  await assert.rejects(checkInHabit('test-app', checkins.id, habit.id, 'UTC', { user: null, isAdmin: false }), /Sign in/);
  assert.equal((await checkInHabit('test-app', checkins.id, habit.id, 'Pacific/Honolulu', viewer)).alreadyDone, true);
  const storedHabit = await store.get('records', habit.id);
  assert.equal(storedHabit.habitTimeZone, 'Asia/Manila');
  records[0].data[checkins.fields.find((f) => f.name === 'Day').id] = '2000-01-01';
  await store.put('records', records[0]);
  assert.equal((await toRuntimeRecords(habits, [storedHabit], viewer))[0].Streak, 0, 'stale streak resets on read');
});

(async () => {
  let failed = 0;
  for (const { name, run } of tests) {
    try { await run(); console.log(`PASS ${name}`); }
    catch (error) { failed++; console.error(`FAIL ${name}\n${error.stack}`); }
  }
  console.log(`${tests.length - failed}/${tests.length} regression checks passed.`);
  process.exitCode = failed ? 1 : 0;
})();
