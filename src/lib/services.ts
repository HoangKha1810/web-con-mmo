import 'server-only';

import { db } from '@/lib/db';
import { fetchAutoMxhServices, fetchSmmServices } from '@/lib/upstream';
import { nowIso, toNumber } from '@/lib/utils';

export type ServicePriceRow = {
  id: number;
  source: 'smm' | 'automxh';
  service_key: string;
  provider_id: number;
  upstream_name: string;
  display_name: string;
  category: string;
  platform: string;
  min_qty: number;
  max_qty: number;
  base_price: number;
  sale_price: number;
  enabled: number;
  raw_json: string;
  created_at: string;
  updated_at: string;
};

function plainService(row: ServicePriceRow): ServicePriceRow {
  return {
    id: Number(row.id),
    source: row.source,
    service_key: String(row.service_key),
    provider_id: Number(row.provider_id || 0),
    upstream_name: String(row.upstream_name || ''),
    display_name: String(row.display_name || ''),
    category: String(row.category || ''),
    platform: String(row.platform || ''),
    min_qty: Number(row.min_qty || 0),
    max_qty: Number(row.max_qty || 0),
    base_price: Number(row.base_price || 0),
    sale_price: Number(row.sale_price || 0),
    enabled: Number(row.enabled || 0),
    raw_json: String(row.raw_json || '{}'),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

function upsertService(input: {
  source: 'smm' | 'automxh';
  service_key: string;
  provider_id?: number;
  upstream_name: string;
  display_name: string;
  category?: string;
  platform?: string;
  min_qty?: number;
  max_qty?: number;
  base_price: number;
  raw: unknown;
}) {
  const existing = db.prepare('SELECT id, sale_price FROM service_prices WHERE source = ? AND service_key = ? AND provider_id = ?').get(
    input.source,
    input.service_key,
    input.provider_id || 0
  ) as { id: number; sale_price: number } | undefined;
  const now = nowIso();
  const salePrice = existing ? Number(existing.sale_price || input.base_price) : Math.ceil(input.base_price * 1.15);

  if (existing) {
    db.prepare(`
      UPDATE service_prices
      SET upstream_name = ?, category = ?, platform = ?, min_qty = ?, max_qty = ?, base_price = ?, raw_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      input.upstream_name,
      input.category || '',
      input.platform || '',
      input.min_qty || 0,
      input.max_qty || 0,
      input.base_price,
      JSON.stringify(input.raw),
      now,
      existing.id
    );
    return;
  }

  db.prepare(`
    INSERT INTO service_prices (
      source, service_key, provider_id, upstream_name, display_name, category, platform,
      min_qty, max_qty, base_price, sale_price, enabled, raw_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).run(
    input.source,
    input.service_key,
    input.provider_id || 0,
    input.upstream_name,
    input.display_name,
    input.category || '',
    input.platform || '',
    input.min_qty || 0,
    input.max_qty || 0,
    input.base_price,
    salePrice,
    JSON.stringify(input.raw),
    now,
    now
  );
}

export async function syncSmmServices() {
  const services = await fetchSmmServices();
  for (const service of services) {
    const serviceId = Number(service.service || service.id || 0);
    if (!serviceId) continue;
    upsertService({
      source: 'smm',
      service_key: String(serviceId),
      provider_id: Number(service.provider_id || 0),
      upstream_name: service.name || `SMM #${serviceId}`,
      display_name: service.name || `SMM #${serviceId}`,
      category: service.category || '',
      platform: service.platform || '',
      min_qty: Number(service.min || 0),
      max_qty: Number(service.max || 0),
      base_price: toNumber(service.price_per_1k_vnd, 0),
      raw: service,
    });
  }
  return services.length;
}

export async function syncAutoMxhServices() {
  const services = await fetchAutoMxhServices();
  for (const service of services) {
    const variantId = Number(service.variant_id || service.id || 0);
    if (!variantId) continue;
    upsertService({
      source: 'automxh',
      service_key: String(variantId),
      provider_id: Number(service.product_id || 0),
      upstream_name: service.name || `AutoMXH #${variantId}`,
      display_name: service.product_name ? `${service.product_name} - ${service.name}` : service.name || `AutoMXH #${variantId}`,
      category: service.category?.name || '',
      platform: service.category?.slug || '',
      min_qty: Number(service.quantity || 1),
      max_qty: Number(service.quantity || 1),
      base_price: toNumber(service.price, 0),
      raw: service,
    });
  }
  return services.length;
}

export async function syncAllServices() {
  const [smm, automxh] = await Promise.all([syncSmmServices(), syncAutoMxhServices()]);
  return { smm, automxh };
}

export function listServices(source?: 'smm' | 'automxh', onlyEnabled = true) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (source) {
    conditions.push('source = ?');
    params.push(source);
  }
  if (onlyEnabled) {
    conditions.push('enabled = 1');
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return (db.prepare(`SELECT * FROM service_prices ${where} ORDER BY source ASC, category ASC, display_name ASC`).all(...(params as any[])) as ServicePriceRow[])
    .map(plainService);
}

export function getService(source: 'smm' | 'automxh', serviceKey: string, providerId = 0) {
  const row = db.prepare(`
    SELECT * FROM service_prices
    WHERE source = ? AND service_key = ? AND provider_id = ? AND enabled = 1
    LIMIT 1
  `).get(source, serviceKey, providerId) as ServicePriceRow | undefined;
  return row ? plainService(row) : undefined;
}

export function getServiceById(id: number) {
  const row = db.prepare('SELECT * FROM service_prices WHERE id = ? LIMIT 1').get(id) as ServicePriceRow | undefined;
  return row ? plainService(row) : undefined;
}

export function updateServicePrice(id: number, input: { display_name?: string; sale_price?: number; enabled?: number }) {
  const current = getServiceById(id);
  if (!current) throw new Error('Không tìm thấy dịch vụ');
  db.prepare(`
    UPDATE service_prices
    SET display_name = ?, sale_price = ?, enabled = ?, updated_at = ?
    WHERE id = ?
  `).run(
    input.display_name ?? current.display_name,
    input.sale_price ?? current.sale_price,
    input.enabled ?? current.enabled,
    nowIso(),
    id
  );
}

export function quoteService(service: ServicePriceRow, quantity: number) {
  if (service.source === 'smm') {
    const qty = Math.max(0, Math.trunc(quantity));
    if (service.min_qty && qty < service.min_qty) {
      throw new Error(`Số lượng tối thiểu là ${service.min_qty}`);
    }
    if (service.max_qty && qty > service.max_qty) {
      throw new Error(`Số lượng tối đa là ${service.max_qty}`);
    }
    return Math.ceil((qty / 1000) * Number(service.sale_price || 0));
  }

  return Math.ceil(Number(service.sale_price || 0));
}

export function quoteSourceServiceCost(service: ServicePriceRow, quantity: number) {
  if (service.source === 'smm') {
    const qty = Math.max(0, Math.trunc(quantity));
    return Math.ceil((qty / 1000) * Number(service.base_price || 0));
  }

  return Math.ceil(Number(service.base_price || 0));
}
