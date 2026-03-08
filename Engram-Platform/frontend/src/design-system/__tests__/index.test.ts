import { describe, expect, it } from 'vitest';
import * as DesignSystem from '../components/index';

describe('design-system barrel exports', () => {
  it('exports Badge', () => {
    expect(DesignSystem.Badge).toBeDefined();
  });

  it('exports Button', () => {
    expect(DesignSystem.Button).toBeDefined();
  });

  it('exports Card', () => {
    expect(DesignSystem.Card).toBeDefined();
  });

  it('exports DataTable', () => {
    expect(DesignSystem.DataTable).toBeDefined();
  });

  it('exports EmptyState', () => {
    expect(DesignSystem.EmptyState).toBeDefined();
  });

  it('exports ErrorState', () => {
    expect(DesignSystem.ErrorState).toBeDefined();
  });

  it('exports Input', () => {
    expect(DesignSystem.Input).toBeDefined();
  });

  it('exports LoadingState', () => {
    expect(DesignSystem.LoadingState).toBeDefined();
  });

  it('exports Modal', () => {
    expect(DesignSystem.Modal).toBeDefined();
  });

  it('exports NavItem', () => {
    expect(DesignSystem.NavItem).toBeDefined();
  });

  it('exports SearchInput', () => {
    expect(DesignSystem.SearchInput).toBeDefined();
  });

  it('exports SectionHeader', () => {
    expect(DesignSystem.SectionHeader).toBeDefined();
  });

  it('exports SidebarGroup', () => {
    expect(DesignSystem.SidebarGroup).toBeDefined();
  });

  it('exports Spinner', () => {
    expect(DesignSystem.Spinner).toBeDefined();
  });

  it('exports StatCard', () => {
    expect(DesignSystem.StatCard).toBeDefined();
  });

  it('exports StatusDot', () => {
    expect(DesignSystem.StatusDot).toBeDefined();
  });

  it('exports Tabs', () => {
    expect(DesignSystem.Tabs).toBeDefined();
  });

  it('exports Tag', () => {
    expect(DesignSystem.Tag).toBeDefined();
  });

  it('exports Toast', () => {
    expect(DesignSystem.Toast).toBeDefined();
  });

  it('exports ToastContainer', () => {
    expect(DesignSystem.ToastContainer).toBeDefined();
  });

  it('exports addToast', () => {
    expect(DesignSystem.addToast).toBeDefined();
  });

  it('exports Tooltip', () => {
    expect(DesignSystem.Tooltip).toBeDefined();
  });
});
