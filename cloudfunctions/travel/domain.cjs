"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/domain/trips.ts
var trips_exports = {};
__export(trips_exports, {
  createTrip: () => createTrip,
  updateTrip: () => updateTrip,
  validateTrip: () => validateTrip
});
module.exports = __toCommonJS(trips_exports);

// src/domain/dates.ts
function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = /* @__PURE__ */ new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
function dateRange(start, end) {
  if (!validDate(start) || !validDate(end) || end < start) throw new Error("\u8BF7\u9009\u62E9\u6709\u6548\u7684\u8D77\u6B62\u65E5\u671F");
  const days = (Date.parse(end) - Date.parse(start)) / 864e5 + 1;
  if (days > 90) throw new Error("\u4E00\u6BB5\u65C5\u884C\u6700\u591A\u5B89\u6392 90 \u5929");
  return Array.from({ length: days }, (_, i) => new Date(Date.parse(start) + i * 864e5).toISOString().slice(0, 10));
}

// src/domain/money.ts
function parseCents(text2) {
  if (!/^\d+(\.\d{1,2})?$/.test(text2.trim())) throw new Error("\u8BF7\u8F93\u5165\u6B63\u786E\u91D1\u989D\uFF0C\u6700\u591A\u4E24\u4F4D\u5C0F\u6570");
  const [a, b = ""] = text2.trim().split(".");
  const n = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (!Number.isSafeInteger(n) || n > 1e8) throw new Error("\u91D1\u989D\u8D85\u51FA\u8303\u56F4");
  return n;
}

// src/domain/types.ts
var uid = () => Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
var clone = (value) => JSON.parse(JSON.stringify(value));

// src/domain/resource-validation.ts
var transportModes = ["driving", "walking", "train", "flight", "bus", "manual"];
var text = (value, max = 120) => typeof value === "string" && value.length <= max;
var datetime = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value) && validDate(value.slice(0, 10));
function validateResources(trip) {
  if (trip.schemaVersion !== void 0 && trip.schemaVersion !== 2) throw Error("\u4E0D\u652F\u6301\u7684\u65C5\u884C\u6570\u636E\u7248\u672C");
  const within = (date) => validDate(date) && date >= trip.startDate && date <= trip.endDate;
  for (const list of [trip.stays ?? [], trip.transports ?? []]) {
    if (!Array.isArray(list) || list.length > 200 || list.some((r) => !r || !text(r.id) || !r.id) || new Set(list.map((r) => r.id)).size !== list.length) throw Error("\u4F4F\u5BBF\u6216\u4EA4\u901A\u8BB0\u5F55\u65E0\u6548");
  }
  for (const stay of trip.stays ?? []) {
    if (stay.kind !== void 0 && !["hotel", "train"].includes(stay.kind)) throw Error("\u8FC7\u591C\u7C7B\u578B\u65E0\u6548");
    if (!text(stay.name) || !stay.name.trim() || !within(stay.checkIn) || !within(stay.checkOut) || stay.checkOut <= stay.checkIn) throw Error("\u4F4F\u5BBF\u9700\u586B\u5199\u540D\u79F0\u53CA\u6709\u6548\u5165\u4F4F\u3001\u9000\u623F\u65E5\u671F\uFF0C\u4E14\u5728\u65C5\u884C\u8303\u56F4\u5185");
    if (!["planned", "booked"].includes(stay.status) || !text(stay.address, 500) || !text(stay.bookingNo) || !text(stay.phone, 80) || !text(stay.note, 2e3) || !Number.isSafeInteger(stay.amount) || stay.amount < 0 || stay.amount > 1e8) throw Error("\u4F4F\u5BBF\u4FE1\u606F\u6216\u9884\u8BA1\u91D1\u989D\u65E0\u6548");
    if (stay.place && (!Number.isFinite(stay.place.latitude) || !Number.isFinite(stay.place.longitude) || Math.abs(stay.place.latitude) > 90 || Math.abs(stay.place.longitude) > 180 || !["tencent", "osm", "manual"].includes(stay.place.provider))) throw Error("\u4F4F\u5BBF\u5730\u70B9\u5750\u6807\u65E0\u6548");
  }
  for (const segment of trip.transports ?? []) {
    if (!text(segment.name) || !segment.name.trim() || !transportModes.includes(segment.mode) || !datetime(segment.departure) || !datetime(segment.arrival) || segment.arrival <= segment.departure || !within(segment.departure.slice(0, 10)) || !within(segment.arrival.slice(0, 10))) throw Error("\u4EA4\u901A\u51FA\u53D1\u3001\u5230\u8FBE\u65F6\u95F4\u65E0\u6548\uFF0C\u8BF7\u660E\u786E\u65E5\u671F\u4E14\u5230\u8FBE\u665A\u4E8E\u51FA\u53D1");
    if (!text(segment.fromName) || !segment.fromName.trim() || !text(segment.toName) || !segment.toName.trim() || !text(segment.bookingNo) || !text(segment.note, 2e3)) throw Error("\u8BF7\u586B\u5199\u4EA4\u901A\u8D77\u7EC8\u70B9\uFF0C\u5E76\u68C0\u67E5\u73ED\u6B21\u548C\u5907\u6CE8");
    if (segment.fromItemId && segment.fromItemId === segment.toItemId) throw Error("\u4EA4\u901A\u8D77\u7EC8\u70B9\u4E0D\u80FD\u5173\u8054\u540C\u4E00\u9879\u8BA1\u5212");
    for (const [id, date] of [[segment.fromItemId, segment.departure.slice(0, 10)], [segment.toItemId, segment.arrival.slice(0, 10)]]) {
      if (id) {
        const item = trip.items.find((i) => i.id === id);
        if (!item || item.date !== date) throw Error("\u8BA1\u5212\u88AB\u4EA4\u901A\u8BB0\u5F55\u5173\u8054\uFF0C\u8BF7\u5148\u4FEE\u6539\u4EA4\u901A\u5173\u8054\u6216\u65E5\u671F\u518D\u79FB\u52A8\u3001\u5220\u9664\u8BA1\u5212");
      }
    }
    if (segment.fromItemId && segment.toItemId && segment.departure.slice(0, 10) === segment.arrival.slice(0, 10)) {
      const day = trip.items.filter((i) => i.date === segment.departure.slice(0, 10)).sort((a, b) => a.order - b.order);
      const from = day.findIndex((i) => i.id === segment.fromItemId), to = day.findIndex((i) => i.id === segment.toItemId);
      if (to !== from + 1) throw Error("\u5DF2\u5173\u8054\u4EA4\u901A\u7684\u51FA\u53D1\u3001\u5230\u8FBE\u4E8B\u9879\u9700\u6309\u987A\u5E8F\u76F8\u90BB\uFF0C\u8BF7\u5148\u8C03\u6574\u4EA4\u901A\u5173\u8054\u518D\u91CD\u6392\u884C\u7A0B");
    }
  }
  if (trip.dayCities !== void 0) {
    if (!trip.dayCities || typeof trip.dayCities !== "object" || Array.isArray(trip.dayCities)) throw Error("\u6BCF\u65E5\u57CE\u5E02\u65E0\u6548");
    for (const [date, city] of Object.entries(trip.dayCities)) if (!within(date) || !text(city, 80) || !city.trim()) throw Error("\u6BCF\u65E5\u57CE\u5E02\u6216\u65E5\u671F\u65E0\u6548");
  }
  for (const item of trip.items) {
    if (item.travelMode !== void 0 && !transportModes.includes(item.travelMode)) throw Error("\u4EA4\u901A\u65B9\u5F0F\u65E0\u6548");
    if (item.completed !== void 0 && typeof item.completed !== "boolean") throw Error("\u884C\u7A0B\u5B8C\u6210\u72B6\u6001\u65E0\u6548");
    if (item.locationStatus !== void 0 && !["confirmed", "not-needed"].includes(item.locationStatus)) throw Error("\u5730\u70B9\u786E\u8BA4\u72B6\u6001\u65E0\u6548");
    if (item.locationStatus === "confirmed" && !item.place) throw Error("\u8BF7\u5148\u6DFB\u52A0\u4F4D\u7F6E\u518D\u786E\u8BA4\u5165\u53E3");
    if (item.locationStatus === "not-needed" && item.place) throw Error("\u5DF2\u6709\u4F4D\u7F6E\u4E0D\u80FD\u6807\u4E3A\u65E0\u9700\u5B9A\u4F4D\uFF0C\u8BF7\u5148\u79FB\u9664\u4F4D\u7F6E");
  }
}

// src/domain/packing.ts
var packingCategories = [
  { id: "clothing", name: "\u8863\u7269", hint: "\u7A7F\u5F97\u8212\u670D\uFF0C\u7559\u51FA\u6362\u6D17" },
  { id: "documents", name: "\u8BC1\u4EF6", hint: "\u51FA\u53D1\u524D\u518D\u68C0\u67E5\u4E00\u6B21" },
  { id: "toiletries", name: "\u6D17\u6F31", hint: "\u5E26\u4E0A\u4E60\u60EF\u7528\u7684\u65E5\u5E38\u7269\u54C1" },
  { id: "electronics", name: "\u7535\u5B50", hint: "\u8BBE\u5907\u3001\u7EBF\u6750\u4E0E\u7535\u91CF" },
  { id: "essentials", name: "\u5E38\u5907\u7269\u54C1", hint: "\u6309\u81EA\u5DF1\u7684\u9700\u8981\u51C6\u5907" },
  { id: "driving", name: "\u81EA\u9A7E\u7528\u54C1", hint: "\u53D6\u8F66\u524D\u6838\u5BF9\u6240\u9700\u7269\u54C1" }
];
function validatePacking(trip) {
  if (trip.packing === void 0) return;
  if (!Array.isArray(trip.packing) || trip.packing.length > 500) throw Error("\u884C\u674E\u6E05\u5355\u683C\u5F0F\u65E0\u6548\u6216\u8D85\u8FC7500\u9879");
  const ids = /* @__PURE__ */ new Set();
  for (const p of trip.packing) {
    if (!p || typeof p.id !== "string" || !p.id || p.id.length > 120 || ids.has(p.id)) throw Error("\u884C\u674E\u7F16\u53F7\u65E0\u6548\u6216\u91CD\u590D");
    ids.add(p.id);
    if (typeof p.name !== "string" || !p.name.trim() || p.name.length > 80) throw Error("\u7269\u54C1\u540D\u79F0\u9700\u586B\u5199\uFF0C\u4E14\u4E0D\u8D85\u8FC780\u5B57");
    if (!packingCategories.some((c) => c.id === p.category)) throw Error("\u884C\u674E\u5206\u7C7B\u65E0\u6548");
    if (p.carryMode !== void 0 && !["pack", "wear"].includes(p.carryMode)) throw Error("\u643A\u5E26\u65B9\u5F0F\u65E0\u6548");
    if (!Number.isSafeInteger(p.quantity) || p.quantity < 1 || p.quantity > 999) throw Error("\u6570\u91CF\u8BF7\u8F93\u51651\u81F3999\u7684\u6574\u6570");
    if (typeof p.memberId !== "string" || p.memberId !== "" && !trip.members.some((m) => m.id === p.memberId)) throw Error("\u884C\u674E\u5F52\u5C5E\u6210\u5458\u4E0D\u5B58\u5728");
    if (typeof p.packed !== "boolean" || typeof p.note !== "string" || p.note.length > 2e3) throw Error("\u6536\u62FE\u72B6\u6001\u6216\u5907\u6CE8\u65E0\u6548");
  }
}
var draft = (category, name, quantity = 1, note = "") => ({ category, name, quantity, note, memberId: "" });
var packingTemplates = [
  { id: "basic", name: "\u65E5\u5E38\u51FA\u884C", description: "\u8BC1\u4EF6\u3001\u6D17\u6F31\u4E0E\u7535\u5B50\u7269\u54C1\uFF0C\u6309\u9700\u52FE\u9009\u3002", items: [draft("documents", "\u8EAB\u4EFD\u8BC1"), draft("toiletries", "\u7259\u5237\u4E0E\u7259\u818F"), draft("toiletries", "\u6BDB\u5DFE"), draft("electronics", "\u624B\u673A\u5145\u7535\u5668"), draft("electronics", "\u5145\u7535\u5B9D"), draft("essentials", "\u7EB8\u5DFE"), draft("essentials", "\u6C34\u676F")] },
  { id: "autumn", name: "\u79CB\u5B63 / \u6237\u5916\u8863\u7269", description: "\u88C5\u5907\u793A\u4F8B\uFF0C\u4E0D\u662F\u76EE\u7684\u5730\u5929\u6C14\u9884\u62A5\uFF1B\u8BF7\u6309\u5B9E\u9645\u5929\u6C14\u4E0E\u6D3B\u52A8\u8C03\u6574\u3002", items: [draft("clothing", "\u5916\u5957"), draft("clothing", "\u4FDD\u6696\u4E2D\u5C42"), draft("clothing", "\u957F\u8896\u4E0A\u8863", 2), draft("clothing", "\u957F\u88E4", 2), draft("clothing", "\u889C\u5B50", 3), draft("clothing", "\u5185\u8863", 3), draft("clothing", "\u8212\u9002\u6B65\u884C\u978B"), draft("clothing", "\u5E3D\u5B50")] },
  { id: "driving", name: "\u81EA\u9A7E\u51C6\u5907", description: "\u7ED3\u5408\u8F66\u8F86\u914D\u7F6E\u4E0E\u79DF\u8F66\u8981\u6C42\u6838\u5BF9\u3002", items: [draft("documents", "\u9A7E\u9A76\u8BC1"), draft("driving", "\u8F66\u8F7D\u5145\u7535\u5668"), draft("driving", "\u624B\u673A\u652F\u67B6"), draft("driving", "\u592A\u9633\u955C")] }
];

// src/domain/guides.ts
var guideCategories = [{ id: "guide", name: "\u6E38\u73A9\u653B\u7565" }, { id: "transport", name: "\u4EA4\u901A\u63D0\u9192" }, { id: "checklist", name: "\u51FA\u884C\u5907\u5FD8" }];
function safeGuideUrl(value) {
  return value.length <= 2e3 && /^https?:\/\/(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?::\d{1,5})?(?:[/?#][^\s<>"\\]*)?$/i.test(value);
}
function validateGuides(trip) {
  if (trip.guides === void 0) return;
  if (!Array.isArray(trip.guides) || trip.guides.length > 300) throw Error("\u653B\u7565\u5217\u8868\u65E0\u6548\u6216\u8D85\u8FC7300\u6761");
  const ids = /* @__PURE__ */ new Set();
  for (const g of trip.guides) {
    if (!g || typeof g.id !== "string" || !g.id.trim() || g.id.length > 120 || ids.has(g.id)) throw Error("\u653B\u7565\u7F16\u53F7\u65E0\u6548\u6216\u91CD\u590D");
    ids.add(g.id);
    if (typeof g.title !== "string" || !g.title.trim() || g.title.length > 120) throw Error("\u653B\u7565\u6807\u9898\u9700\u586B\u5199\uFF0C\u4E14\u4E0D\u8D85\u8FC7120\u5B57");
    if (typeof g.content !== "string" || g.content.length > 12e3 || g.sourceText !== void 0 && (typeof g.sourceText !== "string" || g.sourceText.length > 4e3)) throw Error("\u653B\u7565\u5185\u5BB9\u6216\u5206\u4EAB\u539F\u6587\u8FC7\u957F");
    if (typeof g.sourceUrl !== "string" || g.sourceUrl !== "" && !safeGuideUrl(g.sourceUrl)) throw Error("\u6765\u6E90\u94FE\u63A5\u987B\u4E3A\u6709\u6548\u7684 http \u6216 https \u7F51\u5740");
    if (!guideCategories.some((c) => c.id === g.category)) throw Error("\u653B\u7565\u5206\u7C7B\u65E0\u6548");
    if (!Array.isArray(g.dates) || g.dates.length > 366 || g.dates.some((d) => typeof d !== "string" || !validDate(d)) || new Set(g.dates).size !== g.dates.length) throw Error("\u653B\u7565\u5173\u8054\u65E5\u671F\u65E0\u6548");
    if (!Array.isArray(g.itemIds) || g.itemIds.length > 500 || g.itemIds.some((id) => typeof id !== "string" || !id.trim() || id.length > 120) || new Set(g.itemIds).size !== g.itemIds.length) throw Error("\u653B\u7565\u5173\u8054\u884C\u7A0B\u65E0\u6548");
  }
}

// src/domain/trips.ts
function createTrip(input) {
  const t = { id: uid(), title: input.title.trim(), city: input.city.trim(), startDate: input.startDate, endDate: input.endDate, budget: parseCents(input.budget || "0"), archived: false, members: [{ id: uid(), name: "\u6211" }], items: [], expenses: [], settlements: [], imports: [], revision: 0 };
  if (input.companion.trim()) t.members.push({ id: uid(), name: input.companion.trim() });
  validateTrip(t);
  return t;
}
function updateTrip(trip, patch) {
  const next = { ...clone(trip), ...patch, revision: trip.revision + 1 };
  validateTrip(next);
  return next;
}
function validateTrip(t) {
  var _a, _b, _c, _d;
  if (!t || typeof t.id !== "string" || !((_a = t.title) == null ? void 0 : _a.trim()) || t.title.length > 60 || !((_b = t.city) == null ? void 0 : _b.trim()) || t.city.length > 80) throw new Error("\u586B\u5199\u65C5\u884C\u540D\u79F0\u548C\u76EE\u7684\u57CE\u5E02");
  const dates = dateRange(t.startDate, t.endDate);
  const cents = (n) => Number.isSafeInteger(n) && n >= 0 && n <= 1e8;
  if (t.dayStartTimes && (typeof t.dayStartTimes !== "object" || Array.isArray(t.dayStartTimes) || Object.entries(t.dayStartTimes).some(([date, time]) => !dates.includes(date) || typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)))) throw new Error("\u6BCF\u65E5\u51FA\u53D1\u65F6\u95F4\u65E0\u6548");
  if (!cents(t.budget)) throw new Error("\u9884\u7B97\u65E0\u6548");
  if (!Array.isArray(t.members) || t.members.length < 1 || t.members.length > 2) throw new Error("\u9996\u7248\u652F\u6301\u4E00\u81F3\u4E24\u4F4D\u540C\u884C\u4EBA");
  const members = t.members.map((m) => m.id);
  if (new Set(members).size !== members.length || t.members.some((m) => {
    var _a2;
    return !m.id || !((_a2 = m.name) == null ? void 0 : _a2.trim()) || m.name.length > 30;
  })) throw new Error("\u540C\u884C\u4EBA\u65E0\u6548");
  if (!Array.isArray(t.items) || t.items.length > 500 || !Array.isArray(t.expenses) || t.expenses.length > 1e3 || !Array.isArray(t.settlements) || t.settlements.length > 1e3 || !Array.isArray(t.imports) || t.imports.length > 1e3) throw new Error("\u65C5\u884C\u8BB0\u5F55\u8D85\u51FA\u8303\u56F4");
  for (const list of [t.items, t.expenses, t.settlements]) if (new Set(list.map((x) => x.id)).size !== list.length) throw new Error("\u8BB0\u5F55\u7F16\u53F7\u91CD\u590D");
  for (const i of t.items) {
    if (!dates.includes(i.date)) throw new Error("\u8303\u56F4\u5916\u4ECD\u6709\u884C\u7A0B\uFF0C\u8BF7\u5148\u79FB\u52A8\u5230\u4FDD\u7559\u7684\u65E5\u671F");
    if (!i.id || !((_c = i.name) == null ? void 0 : _c.trim()) || i.name.length > 120 || !Number.isInteger(i.order) || i.order < 0 || !Number.isInteger(i.duration) || i.duration < 0 || i.duration > 2880 || i.travelMinutes !== void 0 && (!Number.isInteger(i.travelMinutes) || i.travelMinutes < 0 || i.travelMinutes > 2880) || !/^$|^([01]\d|2[0-3]):[0-5]\d$/.test(i.time) || typeof i.note !== "string" || i.note.length > 2e3) throw new Error("\u884C\u7A0B\u65F6\u95F4\u6216\u5185\u5BB9\u65E0\u6548");
    if (i.place && (!Number.isFinite(i.place.latitude) || !Number.isFinite(i.place.longitude) || Math.abs(i.place.latitude) > 90 || Math.abs(i.place.longitude) > 180 || !["tencent", "osm", "manual"].includes(i.place.provider))) throw new Error("\u5730\u70B9\u5750\u6807\u65E0\u6548");
  }
  for (const e of t.expenses) {
    if (!e.id || !((_d = e.title) == null ? void 0 : _d.trim()) || !e.category || !validDate(e.date) || !cents(e.amount) || e.amount === 0 || !members.includes(e.payer) || !e.shares || Object.entries(e.shares).some(([m, n]) => !members.includes(m) || !cents(n)) || Object.values(e.shares).reduce((s, n) => s + n, 0) !== e.amount) throw new Error("\u8D26\u5355\u91D1\u989D\u3001\u4ED8\u6B3E\u4EBA\u6216\u5206\u644A\u4E0D\u6B63\u786E");
  }
  for (const s of t.settlements) if (!s.id || !members.includes(s.from) || !members.includes(s.to) || s.from === s.to || !Number.isSafeInteger(s.amount) || s.amount <= 0 || s.amount > 1e11 || !validDate(s.date)) throw new Error("\u7ED3\u7B97\u8BB0\u5F55\u65E0\u6548");
  validateResources(t);
  validatePacking(t);
  validateGuides(t);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createTrip,
  updateTrip,
  validateTrip
});
