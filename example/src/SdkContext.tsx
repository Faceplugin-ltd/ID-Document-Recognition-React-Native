import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  getMachineCode,
  getLicenseStatus,
  init,
  lastLicenseError,
  readyStatusMessage,
  setActivation,
  writeStatus,
  SDK_SUCCESS,
} from 'document-reader-sdk';
import { demoLicense } from './license';

export type SdkState = {
  status: string;
  ready: boolean;
  machine: string;
  refresh: () => void;
};

const SdkContext = createContext<SdkState | null>(null);

function statusLabel(code: number): string {
  switch (code) {
    case 0:
      return 'Ready';
    case 1:
      return 'License invalid';
    case 2:
      return 'License expired';
    case 3:
      return 'Not activated';
    case 4:
      return 'Init failed';
    case 5:
      return 'No database found';
    case 6:
      return 'Database loading error';
    default:
      return `Failed (${code})`;
  }
}

export function SdkProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState('Loading native SDK…');
  const [ready, setReady] = useState(false);
  const [machine, setMachine] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatus('Loading native SDK…');
        setReady(false);
        const mc = await getMachineCode();
        console.log('[DocReader] machine=', mc);
        if (!cancelled) setMachine(mc);
        const act = await setActivation(demoLicense());
        console.log('[DocReader] setActivation=', act);
        if (act !== SDK_SUCCESS) {
          const detail = await lastLicenseError();
          console.log('[DocReader] license error=', detail);
          if (!cancelled) {
            setStatus(`${statusLabel(act)}${detail ? `: ${detail}` : ''}`);
            setReady(false);
          }
          return;
        }
        const code = await init();
        console.log('[DocReader] init=', code);
        if (!cancelled) {
          let message = statusLabel(code);
          if (code === SDK_SUCCESS) {
            try {
              const license = await getLicenseStatus();
              message = readyStatusMessage(license.label);
            } catch {
              // keep Ready
            }
          }
          setStatus(message);
          setReady(code === SDK_SUCCESS);
          try {
            await writeStatus({
              step: 'js',
              status: message,
              ready: code === SDK_SUCCESS,
              machine: mc,
              code,
            });
          } catch {
            // ignore debug write failures
          }
        }
      } catch (e: any) {
        console.log('[DocReader] init exception=', e?.message ?? String(e));
        if (!cancelled) {
          setStatus(`Init error: ${e?.message ?? String(e)}`);
          setReady(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const value = useMemo(
    () => ({ status, ready, machine, refresh }),
    [status, ready, machine, refresh]
  );

  return <SdkContext.Provider value={value}>{children}</SdkContext.Provider>;
}

export function useSdk(): SdkState {
  const ctx = useContext(SdkContext);
  if (!ctx) throw new Error('useSdk must be used within SdkProvider');
  return ctx;
}
