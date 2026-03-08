import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, ChevronLeft, Globe, Shield, Mail,
  Search, CheckCircle, AlertCircle, Wand2, Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardBody, Button } from '../ui';
import { useReducedMotion } from '../../lib/motion';
import { useWhoisLookup, useThreatIntel, useEmailOsint } from '../../hooks/useOsintServices';

type WizardStep = 'target' | 'services' | 'running' | 'complete';

interface WizardState {
  domain: string;
  ip: string;
  email: string;
  enableWhois: boolean;
  enableThreat: boolean;
  enableEmail: boolean;
}

const STEPS: { key: WizardStep; label: string; icon: typeof Globe }[] = [
  { key: 'target', label: 'Set Targets', icon: Search },
  { key: 'services', label: 'Choose Services', icon: Shield },
  { key: 'running', label: 'Running', icon: Loader2 },
  { key: 'complete', label: 'Results', icon: CheckCircle },
];

export function OsintWizard({ onClose }: { onClose?: () => void }) {
  const prefersReduced = useReducedMotion();
  const [step, setStep] = useState<WizardStep>('target');
  const [state, setState] = useState<WizardState>({
    domain: '', ip: '', email: '',
    enableWhois: true, enableThreat: true, enableEmail: true,
  });
  const [errors, setErrors] = useState<string[]>([]);

  const { lookupDomain, lookupIp, whoisResult, dnsResult } = useWhoisLookup();
  const { checkIpReputation, ipRepResult } = useThreatIntel();
  const { fullEmailCheck, breachResult, emailVerifyResult } = useEmailOsint();

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const canProceed = step === 'target'
    ? state.domain.trim() || state.ip.trim() || state.email.trim()
    : step === 'services'
    ? state.enableWhois || state.enableThreat || state.enableEmail
    : false;

  const runScan = useCallback(async () => {
    setStep('running');
    setErrors([]);
    const newErrors: string[] = [];

    try {
      const promises: Promise<void>[] = [];

      if (state.enableWhois && state.domain.trim()) {
        promises.push(lookupDomain(state.domain.trim()));
      }
      if (state.enableWhois && state.ip.trim()) {
        promises.push(lookupIp(state.ip.trim()));
      }
      if (state.enableThreat && state.ip.trim()) {
        promises.push(checkIpReputation(state.ip.trim()));
      }
      if (state.enableEmail && state.email.trim()) {
        promises.push(fullEmailCheck(state.email.trim()));
      }

      await Promise.allSettled(promises);
    } catch (err) {
      newErrors.push(err instanceof Error ? err.message : 'Scan failed');
    }

    setErrors(newErrors);
    setStep('complete');
  }, [state, lookupDomain, lookupIp, checkIpReputation, fullEmailCheck]);

  const handleNext = () => {
    if (step === 'target') setStep('services');
    else if (step === 'services') runScan();
  };

  const handleBack = () => {
    if (step === 'services') setStep('target');
    else if (step === 'complete') setStep('target');
  };

  const resultCount = [whoisResult, dnsResult, ipRepResult, breachResult, emailVerifyResult].filter(Boolean).length;

  return (
    <motion.div
      initial={prefersReduced ? undefined : { opacity: 0, scale: 0.97 }}
      animate={prefersReduced ? undefined : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-semibold flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-fuchsia" />
              OSINT Investigation Wizard
            </h2>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
            )}
          </div>

          {/* Progress steps */}
          <div className="flex items-center gap-2 mt-4">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isCurrent = s.key === step;
              const isDone = i < stepIndex;
              return (
                <div key={s.key} className="flex items-center gap-2">
                  {i > 0 && <div className={`w-8 h-px ${isDone || isCurrent ? 'bg-cyan' : 'bg-border'}`} />}
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
                    isCurrent ? 'bg-cyan/10 text-cyan border border-cyan/30' :
                    isDone ? 'bg-plasma/10 text-plasma' : 'text-text-mute'
                  }`}>
                    <Icon size={12} className={isCurrent ? 'animate-pulse' : ''} />
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardHeader>

        <CardBody>
          <AnimatePresence mode="wait">
            {/* Step 1: Targets */}
            {step === 'target' && (
              <motion.div
                key="target"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-sm text-text-mute mb-4">
                  Enter one or more targets to investigate. You can provide a domain, IP address, or email — or all three.
                </p>
                <div>
                  <label className="text-xs font-medium text-text-dim block mb-1">Domain</label>
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-cyan" />
                    <input
                      type="text"
                      value={state.domain}
                      onChange={(e) => setState((s) => ({ ...s, domain: e.target.value }))}
                      placeholder="example.com"
                      className="flex-1 bg-abyss border border-border rounded px-3 py-2 text-sm text-text placeholder:text-text-mute focus:outline-none focus:border-cyan/50 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-dim block mb-1">IP Address</label>
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-plasma" />
                    <input
                      type="text"
                      value={state.ip}
                      onChange={(e) => setState((s) => ({ ...s, ip: e.target.value }))}
                      placeholder="1.2.3.4"
                      className="flex-1 bg-abyss border border-border rounded px-3 py-2 text-sm text-text placeholder:text-text-mute focus:outline-none focus:border-plasma/50 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-dim block mb-1">Email Address</label>
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-fuchsia" />
                    <input
                      type="email"
                      value={state.email}
                      onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))}
                      placeholder="user@example.com"
                      className="flex-1 bg-abyss border border-border rounded px-3 py-2 text-sm text-text placeholder:text-text-mute focus:outline-none focus:border-fuchsia/50 font-mono"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Services */}
            {step === 'services' && (
              <motion.div
                key="services"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <p className="text-sm text-text-mute mb-4">
                  Select which intelligence services to run against your targets.
                </p>
                {[
                  { key: 'enableWhois' as const, label: 'WHOIS & DNS Intelligence', desc: 'Domain registration, DNS records, IP geolocation', icon: Globe, color: 'cyan' },
                  { key: 'enableThreat' as const, label: 'Threat Intelligence', desc: 'Shodan, VirusTotal, IP reputation scoring', icon: Shield, color: 'neon-r' },
                  { key: 'enableEmail' as const, label: 'Email Intelligence', desc: 'Breach history, email verification, identity lookup', icon: Mail, color: 'fuchsia' },
                ].map((svc) => {
                  const Icon = svc.icon;
                  const enabled = state[svc.key];
                  return (
                    <button
                      key={svc.key}
                      onClick={() => setState((s) => ({ ...s, [svc.key]: !s[svc.key] }))}
                      className={`w-full flex items-center gap-4 p-4 rounded border transition-all ${
                        enabled
                          ? `bg-${svc.color}/5 border-${svc.color}/30`
                          : 'bg-surface border-border hover:border-border-hi'
                      }`}
                    >
                      <div className={`p-2 rounded ${enabled ? `bg-${svc.color}/10` : 'bg-abyss'}`}>
                        <Icon size={20} className={enabled ? `text-${svc.color}` : 'text-text-mute'} />
                      </div>
                      <div className="flex-1 text-left">
                        <span className="text-sm font-medium text-text block">{svc.label}</span>
                        <span className="text-xs text-text-mute">{svc.desc}</span>
                      </div>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        enabled ? `border-${svc.color} bg-${svc.color}/20` : 'border-border'
                      }`}>
                        {enabled && <CheckCircle size={12} className={`text-${svc.color}`} />}
                      </div>
                    </button>
                  );
                })}
              </motion.div>
            )}

            {/* Step 3: Running */}
            {step === 'running' && (
              <motion.div
                key="running"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-12 text-center"
              >
                <div className="animate-spin w-10 h-10 border-3 border-cyan/30 border-t-cyan rounded-full mx-auto mb-4" />
                <p className="text-sm text-text-mute">Running intelligence gathering...</p>
                <p className="text-xs text-text-mute mt-2">This may take a few moments</p>
              </motion.div>
            )}

            {/* Step 4: Complete */}
            {step === 'complete' && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                {errors.length > 0 && (
                  <div className="p-3 bg-neon-r/10 border border-neon-r/30 rounded text-sm text-neon-r flex items-center gap-2">
                    <AlertCircle size={16} />
                    {errors.join('; ')}
                  </div>
                )}
                <div className="flex items-center gap-3 p-4 bg-plasma/5 border border-plasma/30 rounded">
                  <CheckCircle className="w-8 h-8 text-plasma" />
                  <div>
                    <p className="text-sm font-medium text-text">Investigation Complete</p>
                    <p className="text-xs text-text-mute">{resultCount} data sources returned results. View details in the OSINT panels above.</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {whoisResult && (
                    <div className="p-3 bg-surface border border-border rounded text-center">
                      <Globe className="w-5 h-5 text-cyan mx-auto mb-1" />
                      <span className="text-[10px] text-text-mute block">WHOIS</span>
                      <span className="text-xs font-medium text-plasma">Found</span>
                    </div>
                  )}
                  {ipRepResult && (
                    <div className="p-3 bg-surface border border-border rounded text-center">
                      <Shield className="w-5 h-5 text-neon-r mx-auto mb-1" />
                      <span className="text-[10px] text-text-mute block">Threat Score</span>
                      <span className="text-xs font-bold text-text">{ipRepResult.threat_score}/100</span>
                    </div>
                  )}
                  {breachResult && (
                    <div className="p-3 bg-surface border border-border rounded text-center">
                      <Mail className="w-5 h-5 text-fuchsia mx-auto mb-1" />
                      <span className="text-[10px] text-text-mute block">Breaches</span>
                      <span className={`text-xs font-bold ${breachResult.breached ? 'text-neon-r' : 'text-plasma'}`}>
                        {breachResult.breached ? breachResult.breach_count : 'Clean'}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            {step !== 'running' && step !== 'target' ? (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ChevronLeft size={14} className="mr-1" />
                Back
              </Button>
            ) : <div />}
            {(step === 'target' || step === 'services') && (
              <Button
                variant="primary"
                size="sm"
                disabled={!canProceed}
                onClick={handleNext}
              >
                {step === 'services' ? 'Run Investigation' : 'Next'}
                <ChevronRight size={14} className="ml-1" />
              </Button>
            )}
            {step === 'complete' && (
              <Button variant="primary" size="sm" onClick={() => setStep('target')}>
                New Investigation
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    </motion.div>
  );
}
