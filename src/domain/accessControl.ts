export type ProductRole = 'manager' | 'safety' | 'engineer' | 'operator';

export type ProductAction =
  | 'view_dashboard'
  | 'review_finding'
  | 'export_data'
  | 'change_safety_threshold'
  | 'acknowledge_alert'
  | 'run_ai_action';

const ROLE_ACTIONS: Record<ProductRole, ReadonlySet<ProductAction>> = {
  manager: new Set(['view_dashboard', 'export_data', 'acknowledge_alert']),
  safety: new Set(['view_dashboard', 'review_finding', 'acknowledge_alert', 'run_ai_action']),
  engineer: new Set(['view_dashboard', 'export_data', 'run_ai_action']),
  operator: new Set(['view_dashboard', 'acknowledge_alert', 'run_ai_action']),
};

export function canPerformAction(role: ProductRole, action: ProductAction): boolean {
  return ROLE_ACTIONS[role].has(action);
}

export function roleLabel(role: ProductRole, locale: 'zh-CN' | 'en-US' = 'zh-CN'): string {
  const labels: Record<typeof locale, Record<ProductRole, string>> = {
    'zh-CN': {
      manager: '管理者',
      safety: '安全员',
      engineer: '工程师',
      operator: '操作员',
    },
    'en-US': {
      manager: 'Manager',
      safety: 'Safety Officer',
      engineer: 'Engineer',
      operator: 'Operator',
    },
  };
  return labels[locale][role];
}
