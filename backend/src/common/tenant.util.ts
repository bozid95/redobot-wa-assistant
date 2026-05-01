export function slugifyTenantName(name: string) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'tenant';
}

export function getDefaultTenantName() {
  return String(process.env.DEFAULT_TENANT_NAME || 'Default Workspace').trim();
}

export function getDefaultTenantSlug() {
  return slugifyTenantName(process.env.DEFAULT_TENANT_SLUG || getDefaultTenantName() || 'default');
}

export function buildTenantInstanceName(slug: string) {
  const normalized = slugifyTenantName(slug);
  return String(process.env.EVOLUTION_INSTANCE_PREFIX || `wa-${normalized}`).slice(0, 50);
}
