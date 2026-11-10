import mongoose from 'mongoose';
import { VISIT_SOURCES } from './ListingStat.js';
import { DEVICES, PAGE_SECTIONS } from '../lib/site-stats.js';

const { Schema } = mongoose;

const counters = (keys) => Object.fromEntries(keys.map((k) => [k, { type: Number, default: 0 }]));

/**
 * The storefront's traffic for one day (marketplace timezone), written with $inc by POST /api/stats/visit and read by
 * the admin dashboard. Anonymous: no IPs, ids or paths are stored, only counters.
 *   views     every page view (including client-side navigations)
 *   visitors  first page view of the day from a browser (unique visitors per day)
 *   newVisitors  the first visit ever from that browser
 *   sources / devices / sections  split of `visitors` (sources, devices) and of `views` (sections)
 *   countries  { PK: 12, AE: 3, … } split of `visitors`, from Cloudflare's CF-IPCountry header
 */
const siteStatSchema = new Schema(
  {
    day: { type: String, required: true, unique: true }, // "2026-11-09"
    views: { type: Number, default: 0 },
    visitors: { type: Number, default: 0 },
    newVisitors: { type: Number, default: 0 },
    sources: counters(VISIT_SOURCES),
    devices: counters(DEVICES.map((d) => d.key)),
    sections: counters(PAGE_SECTIONS.map((s) => s.key)),
    // No default: an upsert would set `countries: {}` and clash with its own $inc on `countries.PK`.
    countries: { type: Schema.Types.Mixed },
  },
  { versionKey: false },
);

export default mongoose.models.SiteStat || mongoose.model('SiteStat', siteStatSchema);
