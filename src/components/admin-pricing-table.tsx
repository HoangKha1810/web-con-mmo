'use client';

import { Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PlatformIcon } from '@/components/platform-icon';
import { getPlatformMeta, normalizeCatalogText } from '@/lib/platforms';
import type { PlatformMeta } from '@/lib/platforms';
import type { ServicePriceRow } from '@/lib/services';
import { formatMoney } from '@/lib/utils';

type SourceFilter = 'all' | 'smm' | 'automxh';

type PlatformOption = {
  meta: PlatformMeta;
  count: number;
};

const sourceLabels: Record<SourceFilter, string> = {
  all: 'Tất cả',
  smm: 'SMM',
  automxh: 'AutoMXH',
};

function sourceCount(services: ServicePriceRow[], source: SourceFilter) {
  if (source === 'all') return services.length;
  return services.filter((service) => service.source === source).length;
}

export function AdminPricingTable({ services }: { services: ServicePriceRow[] }) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [query, setQuery] = useState('');

  const servicesWithMeta = useMemo(
    () => services.map((service) => ({ service, meta: getPlatformMeta(service) })),
    [services]
  );

  const platformOptions = useMemo(() => {
    const map = new Map<string, PlatformOption>();
    for (const item of servicesWithMeta) {
      if (sourceFilter !== 'all' && item.service.source !== sourceFilter) continue;
      const current = map.get(item.meta.key);
      map.set(item.meta.key, {
        meta: item.meta,
        count: (current?.count || 0) + 1,
      });
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.meta.key === 'other') return 1;
      if (b.meta.key === 'other') return -1;
      return b.count - a.count || a.meta.label.localeCompare(b.meta.label);
    });
  }, [servicesWithMeta, sourceFilter]);

  const normalizedQuery = normalizeCatalogText(query);
  const filteredServices = useMemo(() => {
    return servicesWithMeta
      .filter((item) => {
        if (sourceFilter !== 'all' && item.service.source !== sourceFilter) return false;
        if (platformFilter !== 'all' && item.meta.key !== platformFilter) return false;
        if (!normalizedQuery) return true;
        const searchable = normalizeCatalogText(
          [
            item.service.id,
            item.service.source,
            item.service.service_key,
            item.service.provider_id,
            item.service.display_name,
            item.service.upstream_name,
            item.service.category,
            item.service.platform,
            item.meta.label,
          ].join(' ')
        );
        return searchable.includes(normalizedQuery);
      })
      .map((item) => item.service);
  }, [servicesWithMeta, sourceFilter, platformFilter, normalizedQuery]);

  function chooseSource(source: SourceFilter) {
    setSourceFilter(source);
    setPlatformFilter('all');
  }

  return (
    <section className="pricing-admin reveal">
      <div className="pricing-filter-panel">
        <div className="pricing-filter-head">
          <div>
            <div className="badge">
              <SlidersHorizontal size={14} />
              Bộ lọc set giá
            </div>
            <h2>Lọc nhanh dịch vụ cần chỉnh</h2>
            <p className="muted">Chọn loại dịch vụ, nền tảng hoặc tìm theo ID, tên gói, category để sửa giá nhanh hơn.</p>
          </div>
          <label className="search-box pricing-search">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm ID, tên dịch vụ, category..."
            />
          </label>
        </div>

        <div className="pricing-filter-section">
          <span className="label">Loại dịch vụ</span>
          <div className="source-filter-row">
            {(['all', 'smm', 'automxh'] as SourceFilter[]).map((source) => (
              <button
                className={`source-filter-button ${sourceFilter === source ? 'active' : ''}`}
                key={source}
                type="button"
                onClick={() => chooseSource(source)}
              >
                <span>{sourceLabels[source]}</span>
                <strong>{sourceCount(services, source)}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="pricing-filter-section">
          <span className="label">Nền tảng</span>
          <div className="platform-row pricing-platform-row">
            <button
              className={`platform-pill ${platformFilter === 'all' ? 'active' : ''}`}
              type="button"
              onClick={() => setPlatformFilter('all')}
            >
              <span className="social-mark green">#</span>
              Tất cả nền tảng
              <strong>{sourceCount(services, sourceFilter)}</strong>
            </button>
            {platformOptions.map((item) => (
              <button
                className={`platform-pill ${platformFilter === item.meta.key ? 'active' : ''}`}
                key={item.meta.key}
                type="button"
                onClick={() => setPlatformFilter(item.meta.key)}
              >
                <PlatformIcon meta={item.meta} />
                {item.meta.label}
                <strong>{item.count}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="pricing-summary">
          Đang hiển thị <strong>{filteredServices.length}</strong> / {services.length} dịch vụ.
          {sourceFilter !== 'all' ? ` Loại: ${sourceLabels[sourceFilter]}.` : ''}
          {platformFilter !== 'all' ? ` Nền tảng: ${platformOptions.find((item) => item.meta.key === platformFilter)?.meta.label || platformFilter}.` : ''}
        </div>
      </div>

      <div className="table-wrap pricing-table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Loại</th>
              <th>Dịch vụ</th>
              <th>Nền tảng</th>
              <th>Base</th>
              <th>Giá web con</th>
              <th>Bật</th>
              <th>Lưu</th>
            </tr>
          </thead>
          <tbody>
            {filteredServices.length ? (
              filteredServices.map((service) => {
                const platformMeta = getPlatformMeta(service);
                return (
                  <tr key={service.id}>
                    <td>#{service.id}</td>
                    <td>
                      <span className="badge">{service.source}</span>
                    </td>
                    <td>
                      <form id={`price-${service.id}`} action="/api/admin/pricing" method="post" className="grid">
                        <input type="hidden" name="action" value="update" />
                        <input type="hidden" name="id" value={service.id} />
                        <input className="input" name="display_name" defaultValue={service.display_name} />
                      </form>
                      <div className="muted pricing-row-meta">{service.category || service.upstream_name}</div>
                    </td>
                    <td>
                      <div className="pricing-platform-cell">
                        <PlatformIcon meta={platformMeta} />
                        <span>{platformMeta.label}</span>
                      </div>
                    </td>
                    <td className="money">{formatMoney(service.base_price)} đ</td>
                    <td>
                      <input
                        className="input"
                        form={`price-${service.id}`}
                        name="sale_price"
                        type="number"
                        defaultValue={service.sale_price}
                      />
                    </td>
                    <td>
                      <select className="select" form={`price-${service.id}`} name="enabled" defaultValue={service.enabled}>
                        <option value="1">Bật</option>
                        <option value="0">Tắt</option>
                      </select>
                    </td>
                    <td>
                      <button className="btn secondary" form={`price-${service.id}`}>
                        Lưu
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <strong>Không có dịch vụ phù hợp</strong>
                    <span>Thử đổi loại, nền tảng hoặc từ khóa tìm kiếm.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
