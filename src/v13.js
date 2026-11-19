const languageKey = 'kaka-language';
let language = localStorage.getItem(languageKey) === 'en' ? 'en' : 'ko';
document.documentElement.lang = language;
const t = (ko, en = english[ko]) => language === 'en' ? en ?? ko : ko;

const serviceGroups = [
  ['엔진 · 구동계', 'Engine & drivetrain', [
    ['엔진오일', '엔진 오일', 'Engine oil'], ['엔진부품', '엔진 부품', 'Engine parts'],
    ['미션오일', '미션 오일', 'Transmission fluid', '변속기 오일', '변속기유'], ['클러치', '클러치', 'Clutch'],
    ['연료 / 흡기 / 배기', '연료 / 흡기 / 배기', 'Fuel / intake / exhaust'],
    ['점화플러그', '점화 플러그', 'Spark plugs'], ['점화코일', '점화 코일', 'Ignition coils']
  ]],
  ['브레이크', 'Brakes', [
    ['브레이크오일', '브레이크 오일', 'Brake fluid', '브레이크액', '제동액'],
    ['브레이크패드', '브레이크 패드', 'Brake pads', '브레이크 패드 점검'],
    ['브레이크디스크', '브레이크 디스크', 'Brake discs', '브레이크 로터', '브레이크 디스크 점검']
  ]],
  ['타이어 · 하체', 'Tires & suspension', [
    ['타이어 위치 교환', '타이어 위치 교환', 'Tire rotation'],
    ['서스펜션 / 쇼바', '서스펜션 / 쇼바', 'Suspension / shocks'],
    ['조향장치 / 얼라인먼트', '조향 장치 / 얼라인먼트', 'Steering / alignment'],
    ['하체 / 부싱 / 베어링', '하체 / 부싱 / 베어링', 'Undercarriage / bushings / bearings'],
    ['타이어', '타이어', 'Tires', '타이어/휠']
  ]],
  ['냉각 · 공조', 'Cooling & climate', [
    ['냉각수', '냉각수', 'Coolant', '부동액', '냉각수 (최초 교체 후)'], ['에어컨 / 히터', '에어컨 / 히터', 'A/C / heater'],
    ['에어컨 필터', '에어컨 필터', 'Cabin air filter']
  ]],
  ['전기 · 소모품', 'Electrical & consumables', [
    ['배터리', '배터리', 'Battery'], ['전기장치', '전기 장치', 'Electrical system'], ['와이퍼', '와이퍼', 'Wipers']
  ]],
  ['차량 관리 · 기타', 'Car care & other', [
    ['정기검사 / 점검', '정기 검사 / 점검', 'Inspection'], ['세차 / 광택 / 코팅', '세차 / 광택 / 코팅', 'Wash / polish / coating'],
    ['외장 / 내장', '외장 / 내장', 'Exterior / interior'], ['리콜 / 보증수리', '리콜 / 보증 수리', 'Recall / warranty repair']
  ]]
];
const serviceAliases = new Map();
for (const [, , entries] of serviceGroups) {
  for (const entry of entries) for (const alias of entry) serviceAliases.set(searchKey(alias), entry);
}
const legacyDetailLabels = new Map([
  ['브레이크패드점검', ['브레이크 패드 점검', 'Brake pad inspection']],
  ['브레이크디스크점검', ['브레이크 디스크 점검', 'Brake disc inspection']],
  ['냉각수(최초교체후)', ['냉각수 (최초 교체 후)', 'Coolant (after first replacement)']]
]);
function searchKey(value) {
  return String(value ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, '');
}
function serviceEntry(name) {
  return serviceAliases.get(searchKey(name));
}
function serviceLabel(name) {
  const entry = serviceEntry(name);
  return entry ? t(entry[1], entry[2]) : name;
}
function cycleLabel(cycle) {
  const preset = PRESETS.find(([id, name]) => cycle.id === 'preset-' + id && searchKey(name) === searchKey(cycle.name));
  return preset ? serviceLabel(cycle.name) : cycle.name;
}
function itemLabel(item, vehicle = state) {
  if (isCustomService(item.service, vehicle)) return item.service;
  const detail = legacyDetailLabels.get(searchKey(item.service));
  return detail ? t(...detail) : serviceLabel(item.service);
}
function isCustomService(name, vehicle) {
  return vehicle?.cycles.some(c => !c.id.startsWith('preset-') && c.name === name);
}
function matchesSearch(query, values) {
  const key = searchKey(query);
  if (!key) return true;
  const tokens = query.trim().split(/[\s/·]+/).map(searchKey).filter(Boolean);
  const keys = values.map(searchKey);
  return keys.some(value => value.includes(key)) ||
    (tokens.length > 1 && tokens.every(token => keys.some(value => value.includes(token))));
}
function monthLabel(month) {
  return language === 'en'
    ? new Intl.DateTimeFormat('en', {month: 'short'}).format(new Date(2000, month, 1))
    : (month + 1) + '월';
}
function recordCountText(count) {
  return t(count + '건', count + (count === 1 ? ' record' : ' records'));
}
function yearModel(year) {
  return year ? t(year + '년식', 'Model year ' + year) : '';
}

function fillServicePicker(select, query, selected = '') {
  const searching = Boolean(query.trim());
  let count = 0;
  const optionGroup = (label, entries) => {
    const group = document.createElement('optgroup');
    group.label = label;
    for (const [value, display, ...aliases] of entries) {
      if (matchesSearch(query, [value, display, label, ...aliases])) {
        group.append(new Option(display, value));
        count++;
      }
    }
    if (group.children.length) select.append(group);
  };
  select.replaceChildren(new Option(searching ? t('검색 결과에서 선택', 'Choose a match') : t('정비 항목 선택', 'Select a service item'), ''));
  for (const [ko, en, entries] of serviceGroups) {
    optionGroup(t(ko, en), entries.map(entry => [entry[0], serviceLabel(entry[0]), ...entry, ko, en]));
  }
  const seen = new Set(serviceAliases.keys());
  const custom = [];
  for (const cycle of state.cycles || []) {
    const key = searchKey(cycle.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    custom.push([cycle.name, cycleLabel(cycle)]);
  }
  optionGroup(t('내 소모품', 'My consumables'), custom);
  if (searching && !count) select.options[0].textContent = t('검색 결과 없음', 'No matches');
  select.add(new Option(t('직접 입력', 'Enter manually'), '__kaka_manual__'));
  if ([...select.options].some(option => option.value === selected)) select.value = selected;
  return count;
}

const mileagePattern = /^(?:\d+|\d{1,3}(?:,\d{3})+)$/;
function storedNumber(value) {
  const parsed = Number(String(value ?? '').trim().replaceAll(',', ''));
  return Number.isFinite(parsed) ? parsed : 0;
}
function recordCost(record) {
  return record.cost != null && String(record.cost).trim() !== ''
    ? storedNumber(record.cost)
    : (record.items || []).reduce((sum, item) => sum + storedNumber(item.cost), 0);
}
function mileageConflict(date, mileage, id) {
  if (!validDate(date) || !mileagePattern.test(mileage)) return '';
  const value = numberValue(mileage);
  const conflicts = state.records.filter(record => {
    const saved = String(record.mileage ?? '');
    if (String(record.id) === id || !mileagePattern.test(saved)) return false;
    const distance = storedNumber(saved);
    return (record.date < date && distance > value) || (record.date > date && distance < value);
  });
  if (!conflicts.length) return '';
  conflicts.sort((a, b) => Math.abs(Date.parse(date) - Date.parse(a.date)) - Math.abs(Date.parse(date) - Date.parse(b.date)));
  const record = conflicts[0];
  const reference = record.date + ' · ' + storedNumber(record.mileage).toLocaleString('ko-KR') + ' km';
  return record.date < date
    ? t('이전 정비 기록보다 주행거리가 짧습니다. 비교 기록 ' + reference, 'Mileage is lower than an earlier service record. Compare ' + reference)
    : t('이후 정비 기록보다 주행거리가 깁니다. 비교 기록 ' + reference, 'Mileage is higher than a later service record. Compare ' + reference);
}

function updateMileageWarning() {
  const input = $('mileage');
  const text = input.validity.customError ? input.validationMessage : mileageConflict($('date').value, input.value, $('recordId').value);
  input.setAttribute('aria-invalid', String(input.validity.customError));
  $('mileageWarning').textContent = text;
  $('mileageWarning').hidden = !text;
}
