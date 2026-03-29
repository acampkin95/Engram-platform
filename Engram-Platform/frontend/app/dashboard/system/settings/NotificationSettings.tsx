'use client';

import { Bell, CheckCircle, Mail, Send, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { FadeIn } from '@/src/components/animations/PageTransition';
import { StaggerContainer, StaggerItem } from '@/src/components/animations/stagger';
import { Button } from '@/src/design-system/components/Button';
import { Card } from '@/src/design-system/components/Card';
import { StatusDot } from '@/src/design-system/components/StatusDot';
import { addToast } from '@/src/design-system/components/Toast';
import { systemClient } from '@/src/lib/system-client';

type ChannelStatus = {
  resend: { configured: boolean; from: string | null };
  ntfy: { configured: boolean; topicUrl: string | null; authenticated: boolean };
};

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        ok
          ? 'border border-[#2ee6a6]/20 bg-[#2ee6a6]/10 text-[#2ee6a6]'
          : 'border border-[#ff4757]/20 bg-[#ff4757]/10 text-[#ff4757]'
      }`}
    >
      {ok ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

type TestResult = {
  success: boolean;
  error?: string | null;
  timestamp: Date;
};

function TestResultDisplay({ result }: { result: TestResult | null }) {
  if (!result) return null;
  const timeAgo = Math.round((Date.now() - result.timestamp.getTime()) / 1000);
  const timeLabel = timeAgo < 60 ? `${timeAgo}s ago` : `${Math.round(timeAgo / 60)}m ago`;

  return (
    <div
      className={`mt-2 flex items-center gap-1.5 text-[10px] ${
        result.success ? 'text-[#2ee6a6]' : 'text-[#ff4757]'
      }`}
    >
      {result.success ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      <span>{result.success ? 'Sent successfully' : (result.error ?? 'Failed')}</span>
      <span className="text-[#5c5878]">{timeLabel}</span>
    </div>
  );
}

export default function NotificationSettings() {
  const [status, setStatus] = useState<ChannelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Record<string, TestResult | null>>({
    email: null,
    ntfy: null,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await systemClient.getNotificationSettings();
    if (res.data) setStatus(res.data as ChannelStatus);
    if (res.error) addToast({ type: 'error', message: res.error });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const testChannel = async (channel: 'email' | 'ntfy') => {
    setTesting((prev) => new Set(prev).add(channel));
    const res = await systemClient.testNotificationChannel(channel);
    setTesting((prev) => {
      const next = new Set(prev);
      next.delete(channel);
      return next;
    });

    if (res.error) {
      setTestResults((prev) => ({
        ...prev,
        [channel]: { success: false, error: res.error, timestamp: new Date() },
      }));
      addToast({ type: 'error', message: res.error });
      return;
    }

    const data = res.data as Record<string, { success: boolean; error?: string }> | null;
    const result = data?.[channel];
    if (result?.success) {
      setTestResults((prev) => ({
        ...prev,
        [channel]: { success: true, timestamp: new Date() },
      }));
      addToast({ type: 'success', message: `Test ${channel} notification sent` });
    } else {
      setTestResults((prev) => ({
        ...prev,
        [channel]: { success: false, error: result?.error, timestamp: new Date() },
      }));
      addToast({ type: 'error', message: result?.error ?? `Failed to send test ${channel}` });
    }
  };

  return (
    <StaggerContainer className="space-y-6" variant="card">
      <FadeIn className="flex items-center justify-between gap-4" delay={0.02}>
        <div>
          <div className="mb-2 flex items-center gap-3">
            <StatusDot
              variant={
                status?.resend.configured && status?.ntfy.configured
                  ? 'online'
                  : status?.resend.configured || status?.ntfy.configured
                    ? 'degraded'
                    : 'offline'
              }
              label="Config"
            />
            <span className="rounded-full border border-[#2EC4C4]/20 bg-[#2EC4C4]/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.22em] text-[#2EC4C4]">
              Alert Channels
            </span>
          </div>
          <h1 className="text-2xl font-bold font-display text-[#f0eef8]">Notification Settings</h1>
          <p className="text-sm text-[#a09bb8]">
            Configure email and push notification channels for system alerts.
          </p>
        </div>
      </FadeIn>

      <StaggerItem variant="card">
        <div className="grid gap-6 md:grid-cols-2">
          <Card
            variant="elevated"
            header={
              <div className="flex items-center gap-2 text-sm font-medium text-[#f0eef8]">
                <Mail className="h-4 w-4 text-[#f2a93b]" />
                Resend Email
              </div>
            }
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <StatusBadge
                  ok={status?.resend.configured ?? false}
                  label={status?.resend.configured ? 'Configured' : 'Not configured'}
                />
                {status?.resend.from && (
                  <p className="text-xs text-[#a09bb8]">
                    Sender: <span className="font-mono text-[#f0eef8]">{status.resend.from}</span>
                  </p>
                )}
                {!status?.resend.configured && (
                  <p className="text-xs text-[#5c5878]">
                    Set{' '}
                    <code className="rounded bg-[#222633] px-1 py-0.5 font-mono text-[#a09bb8]">
                      RESEND_API_KEY
                    </code>{' '}
                    and{' '}
                    <code className="rounded bg-[#222633] px-1 py-0.5 font-mono text-[#a09bb8]">
                      EMAIL_FROM
                    </code>{' '}
                    in your{' '}
                    <code className="rounded bg-[#222633] px-1 py-0.5 font-mono text-[#a09bb8]">
                      .env
                    </code>{' '}
                    file.
                  </p>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void testChannel('email')}
                loading={testing.has('email')}
                disabled={loading || !status?.resend.configured}
              >
                <Send className="h-3.5 w-3.5" /> Send Test Email
              </Button>
              <TestResultDisplay result={testResults.email} />
            </div>
          </Card>

          <Card
            variant="elevated"
            header={
              <div className="flex items-center gap-2 text-sm font-medium text-[#f0eef8]">
                <Bell className="h-4 w-4 text-[#7c5cbf]" />
                ntfy.sh Push
              </div>
            }
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    ok={status?.ntfy.configured ?? false}
                    label={status?.ntfy.configured ? 'Configured' : 'Not configured'}
                  />
                  {status?.ntfy.configured && (
                    <StatusBadge
                      ok={status.ntfy.authenticated}
                      label={status.ntfy.authenticated ? 'Authenticated' : 'Anonymous'}
                    />
                  )}
                </div>
                {status?.ntfy.topicUrl && (
                  <p className="text-xs text-[#a09bb8]">
                    Topic: <span className="font-mono text-[#f0eef8]">{status.ntfy.topicUrl}</span>
                  </p>
                )}
                {!status?.ntfy.configured && (
                  <p className="text-xs text-[#5c5878]">
                    Set{' '}
                    <code className="rounded bg-[#222633] px-1 py-0.5 font-mono text-[#a09bb8]">
                      NTFY_TOPIC_URL
                    </code>{' '}
                    in your{' '}
                    <code className="rounded bg-[#222633] px-1 py-0.5 font-mono text-[#a09bb8]">
                      .env
                    </code>{' '}
                    file. Optionally add{' '}
                    <code className="rounded bg-[#222633] px-1 py-0.5 font-mono text-[#a09bb8]">
                      NTFY_API_KEY
                    </code>{' '}
                    for authenticated topics.
                  </p>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void testChannel('ntfy')}
                loading={testing.has('ntfy')}
                disabled={loading || !status?.ntfy.configured}
              >
                <Send className="h-3.5 w-3.5" /> Send Test Push
              </Button>
              <TestResultDisplay result={testResults.ntfy} />
            </div>
          </Card>
        </div>
      </StaggerItem>

      <StaggerItem variant="card">
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={() => {
              void testChannel('email');
              void testChannel('ntfy');
            }}
            loading={testing.size > 0}
            disabled={loading || (!status?.resend.configured && !status?.ntfy.configured)}
          >
            <Send className="h-3.5 w-3.5" /> Test All Channels
          </Button>
        </div>
      </StaggerItem>

      <StaggerItem variant="card">
        <Card variant="elevated">
          <div className="space-y-2 text-xs text-[#5c5878]">
            <p className="font-medium text-[#a09bb8]">Configuration</p>
            <p>
              Notification channels are configured via environment variables in{' '}
              <code className="rounded bg-[#222633] px-1 py-0.5 font-mono text-[#a09bb8]">
                .env
              </code>
              . API keys are never exposed in the UI for security.
            </p>
            <p>
              After changing environment variables, rebuild the frontend container:{' '}
              <code className="rounded bg-[#222633] px-1 py-0.5 font-mono text-[#a09bb8]">
                docker compose up -d --build platform-frontend
              </code>
            </p>
          </div>
        </Card>
      </StaggerItem>
    </StaggerContainer>
  );
}
