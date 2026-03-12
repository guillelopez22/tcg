"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeAnalytics = void 0;
function computeAnalytics(cards) {
    const energyCurve = {};
    const domainDistribution = {};
    for (const card of cards) {
        const qty = card.quantity != null ? card.quantity : 1;
        const cost = card.energyCost != null ? card.energyCost : 0;
        const bucket = cost >= 8 ? '8+' : cost;
        energyCurve[bucket] = (energyCurve[bucket] || 0) + qty;
        const domain = card.domain != null ? card.domain : 'Neutral';
        domainDistribution[domain] = (domainDistribution[domain] || 0) + qty;
    }
    return { energyCurve, domainDistribution };
}
exports.computeAnalytics = computeAnalytics;
