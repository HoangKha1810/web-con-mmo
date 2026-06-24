'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Bookmark, Eye, Hash, Heart, Layers, MessageCircle, Radio, Search, Share2, Sparkles, Star, UserPlus, Users, Zap } from 'lucide-react';
import { ServiceOrderForm } from '@/components/service-order-form';
import { PlatformIcon } from '@/components/platform-icon';
import { cleanServiceCategory, getPlatformMeta, getServiceIntentMeta, normalizeCatalogText, serviceFamily, serviceShortName, serviceUnitLabel, type CatalogService, type ServiceIntentMeta } from '@/lib/platforms';
import { formatMoney } from '@/lib/utils';

type ServiceCatalogProps = {
  source: 'smm' | 'automxh';
  services: CatalogService[];
};

type CatalogFilterGroup = ServiceIntentMeta & {
  total: number;
  minPrice: number;
  order: number;
};

function serviceProductOrder(service: CatalogService) {
  return Number(service.provider_id || service.id || 0);
}

function IntentIcon({ intentKey }: { intentKey: string }) {
  const icons = {
    like: Heart,
    follow: UserPlus,
    view: Eye,
    comment: MessageCircle,
    share: Share2,
    live: Radio,
    member: Users,
    review: Star,
    save: Bookmark,
    other: Sparkles,
  };
  const Icon = icons[intentKey as keyof typeof icons] || Sparkles;
  return <Icon size={16} />;
}

export function ServiceCatalog({ source, services }: ServiceCatalogProps) {
  const isAutoMxh = source === 'automxh';
  const [platform, setPlatform] = useState('all');
  const [intent, setIntent] = useState('all');
  const [family, setFamily] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(services[0]?.id || null);

  const platforms = useMemo(() => {
    const seen = new Map<string, ReturnType<typeof getPlatformMeta> & { total: number }>();
    for (const service of services) {
      const meta = getPlatformMeta(service);
      const current = seen.get(meta.key);
      seen.set(meta.key, { ...meta, total: (current?.total || 0) + 1 });
    }
    return Array.from(seen.values()).sort((a, b) => b.total - a.total);
  }, [services]);

  const platformServices = useMemo(() => {
    if (platform === 'all') return services;
    return services.filter((service) => getPlatformMeta(service).key === platform);
  }, [platform, services]);

  const intentGroups = useMemo(() => {
    const seen = new Map<string, CatalogFilterGroup>();
    for (const service of platformServices) {
      const meta = isAutoMxh
        ? {
            key: serviceFamily(service),
            label: cleanServiceCategory(serviceFamily(service)),
            shortLabel: cleanServiceCategory(serviceFamily(service)),
            tone: getPlatformMeta(service).tone,
          }
        : getServiceIntentMeta(service);
      const current = seen.get(meta.key);
      seen.set(meta.key, {
        ...meta,
        total: (current?.total || 0) + 1,
        minPrice: Math.min(current?.minPrice ?? Number(service.sale_price || 0), Number(service.sale_price || 0)),
        order: current?.order ?? (isAutoMxh ? serviceProductOrder(service) : seen.size),
      });
    }
    const priority = ['like', 'follow', 'view', 'comment', 'share', 'live', 'member', 'review', 'save', 'other'];
    return Array.from(seen.values()).sort((a, b) => {
      if (isAutoMxh) return a.order - b.order;
      const ai = priority.indexOf(a.key);
      const bi = priority.indexOf(b.key);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || b.total - a.total;
    });
  }, [isAutoMxh, platformServices]);

  const intentServices = useMemo(() => {
    if (intent === 'all') return platformServices;
    return platformServices.filter((service) => (
      isAutoMxh ? serviceFamily(service) === intent : getServiceIntentMeta(service).key === intent
    ));
  }, [intent, isAutoMxh, platformServices]);

  const families = useMemo(() => {
    const seen = new Map<string, { name: string; total: number; minPrice: number }>();
    for (const service of intentServices) {
      const name = isAutoMxh ? cleanServiceCategory(service.category) : serviceFamily(service);
      const current = seen.get(name);
      seen.set(name, {
        name,
        total: (current?.total || 0) + 1,
        minPrice: Math.min(current?.minPrice ?? Number(service.sale_price || 0), Number(service.sale_price || 0)),
      });
    }
    return Array.from(seen.values()).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [intentServices, isAutoMxh]);

  const filteredServices = useMemo(() => {
    const normalizedQuery = normalizeCatalogText(query);
    return intentServices.filter((service) => {
      const serviceFamilyKey = isAutoMxh ? cleanServiceCategory(service.category) : serviceFamily(service);
      const matchFamily = family === 'all' || serviceFamilyKey === family;
      const text = normalizeCatalogText(`${service.display_name} ${service.category} ${service.platform}`);
      const matchQuery = !normalizedQuery || text.includes(normalizedQuery);
      return matchFamily && matchQuery;
    });
  }, [family, intentServices, isAutoMxh, query]);

  const selected = filteredServices.find((service) => service.id === selectedId) || filteredServices[0] || services[0];
  const activePlatformLabel = platform === 'all' ? 'Tất cả nền tảng' : platforms.find((item) => item.key === platform)?.label || 'Nền tảng đã chọn';
  const activeIntent = intentGroups.find((item) => item.key === intent);
  const browserTitle = family === 'all'
    ? (activeIntent?.label || (isAutoMxh ? 'Tất cả gói Auto MXH' : 'Tất cả gói dịch vụ'))
    : cleanServiceCategory(family);

  function choosePlatform(key: string) {
    setPlatform(key);
    setIntent('all');
    setFamily('all');
    setSelectedId(null);
  }

  function chooseIntent(key: string) {
    setIntent(key);
    setFamily('all');
    setSelectedId(null);
  }

  function chooseFamily(name: string) {
    setFamily(name);
    setSelectedId(null);
  }

  return (
    <div className="catalog-shell">
      <section className="catalog-toolbar reveal">
        <div>
          <div className="badge green"><Sparkles size={14} /> {source === 'smm' ? 'Bảng dịch vụ SMM' : 'Bảng dịch vụ Auto MXH'}</div>
          <h2>{isAutoMxh ? 'Chọn nền tảng, chọn tab dịch vụ rồi đặt đơn' : 'Chọn nền tảng, chọn nhóm dịch vụ rồi đặt đơn'}</h2>
          <p className="muted">Bảng giá được cập nhật theo cấu hình của hệ thống. Mỗi dịch vụ có hạn mức và đơn giá riêng trước khi tạo đơn.</p>
        </div>
        <label className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={isAutoMxh ? 'Tìm dịch vụ, ví dụ: mở khóa, dame, tick xanh...' : 'Tìm dịch vụ, ví dụ: like, follow, live...'}
          />
        </label>
      </section>

      <div className="platform-row reveal">
        <button className={`platform-pill ${platform === 'all' ? 'active' : ''}`} type="button" onClick={() => choosePlatform('all')}>
          <span className="social-mark green"><Hash size={18} /></span>
          Tất cả
          <strong>{services.length}</strong>
        </button>
        {platforms.map((item) => (
          <button className={`platform-pill ${platform === item.key ? 'active' : ''}`} type="button" key={item.key} onClick={() => choosePlatform(item.key)}>
            <PlatformIcon meta={item} />
            {item.label}
            <strong>{item.total}</strong>
          </button>
        ))}
      </div>

      <section className="interaction-filter reveal">
        <div className="interaction-filter-head">
          <div>
            <strong>{isAutoMxh ? 'Tab dịch vụ Auto MXH' : 'Loại tương tác'}</strong>
            <span>
              {isAutoMxh
                ? `${activePlatformLabel} · lọc đúng nhóm dịch vụ nguồn như mở khóa, dame/rip, tick xanh...`
                : `${activePlatformLabel} · chia theo like, follow, view, bình luận...`}
            </span>
          </div>
          <span className="badge">{intentServices.length} gói</span>
        </div>
        <div className="interaction-row">
          <button className={`interaction-pill ${intent === 'all' ? 'active' : ''}`} type="button" onClick={() => chooseIntent('all')}>
            <Sparkles size={16} />
            {isAutoMxh ? 'Tất cả tab' : 'Tất cả loại'}
            <strong>{platformServices.length}</strong>
          </button>
          {intentGroups.map((item) => (
            <button className={`interaction-pill ${intent === item.key ? 'active' : ''}`} type="button" key={item.key} onClick={() => chooseIntent(item.key)}>
              <span className={`intent-dot ${item.tone}`}>{isAutoMxh ? <Layers size={16} /> : <IntentIcon intentKey={item.key} />}</span>
              <span>{item.shortLabel}</span>
              <small>Từ {formatMoney(item.minPrice)} đ</small>
              <strong>{item.total}</strong>
            </button>
          ))}
        </div>
      </section>

      <div className="catalog-layout">
        <aside className="category-panel reveal">
          <div className="category-panel-head">
            <Layers size={18} />
            <div>
              <strong>Danh mục dịch vụ</strong>
              <span>{families.length} {isAutoMxh ? 'danh mục trong tab đã chọn' : 'nhóm trong loại đã chọn'}</span>
            </div>
          </div>
          <button className={`category-item ${family === 'all' ? 'active' : ''}`} type="button" onClick={() => chooseFamily('all')}>
            <span>Tất cả dịch vụ</span>
            <strong>{intentServices.length}</strong>
          </button>
          {families.map((item) => (
            <button className={`category-item ${family === item.name ? 'active' : ''}`} type="button" key={item.name} onClick={() => chooseFamily(item.name)}>
              <span>{cleanServiceCategory(item.name)}</span>
              <small>Từ {formatMoney(item.minPrice)} đ</small>
              <strong>{item.total}</strong>
            </button>
          ))}
        </aside>

        <section className="service-browser reveal">
          <div className="service-browser-head">
            <div>
              <h3>{browserTitle}</h3>
              <p className="muted">{filteredServices.length} gói phù hợp</p>
            </div>
            <span className="badge amber"><Zap size={14} /> Đặt nhanh</span>
          </div>

          <div className="service-list">
            {filteredServices.map((service) => {
              const meta = getPlatformMeta(service);
              const isActive = selected?.id === service.id;
              return (
                <button className={`service-row ${isActive ? 'active' : ''}`} type="button" key={service.id} onClick={() => setSelectedId(service.id)}>
                  <PlatformIcon meta={meta} />
                  <span className="service-row-main">
                    <strong>{serviceShortName(service)}</strong>
                    <small>
                      {meta.label} · {formatMoney(service.min_qty || 1)} - {service.max_qty ? formatMoney(service.max_qty) : 'không giới hạn'}
                    </small>
                  </span>
                  <span className="service-row-price">
                    <b>{formatMoney(service.sale_price)} đ</b>
                    <small>{serviceUnitLabel(service)}</small>
                  </span>
                  <ArrowRight size={18} />
                </button>
              );
            })}
          </div>
        </section>

        <aside className="order-panel reveal">
          {selected ? (
            <ServiceOrderForm service={selected as any} />
          ) : (
            <div className="form-panel empty-state">
              <Sparkles size={32} />
              <h3>Chưa có dịch vụ phù hợp</h3>
              <p className="muted">Thử đổi nền tảng, danh mục hoặc từ khóa tìm kiếm.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
