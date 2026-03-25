"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  DollarSign,
  SlidersHorizontal,
  Filter,
  Bell,
  Database,
  Save,
  Check,
  AlertCircle,
  Info,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { defaultSettings } from "@/lib/demo-data";
import type { UserSettings } from "@/types";

const STORAGE_KEY = "edgefinder-settings";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

function getKellyLabel(k: number): string {
  if (k <= 0.15) return "Eighth Kelly";
  if (k <= 0.3) return "Quarter Kelly";
  if (k <= 0.4) return "Third Kelly";
  if (k <= 0.55) return "Half Kelly";
  return "Full Kelly";
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<UserSettings>;
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}
    setMounted(true);
  }, []);

  const update = useCallback(
    <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  function handleSave() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setToast("Settings saved successfully");
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast("Failed to save settings");
      setTimeout(() => setToast(null), 2500);
    }
  }

  const maxBet = settings.bankroll * 0.05;
  const typicalLow = settings.bankroll * settings.kellyMultiplier * 0.01;
  const typicalHigh = settings.bankroll * settings.kellyMultiplier * 0.06;

  if (!mounted) return null;

  return (
    <div className="pt-8 pb-12">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="max-w-2xl mx-auto space-y-6"
      >
        {/* Header */}
        <motion.div variants={fadeUp} className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
              <p className="text-sm text-gray-500">
                Configure bankroll, bet sizing, and notification preferences.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Bankroll Management */}
        <motion.div variants={fadeUp}>
          <Card className="glass border-white/[0.06] bg-transparent">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4 text-orange-400" />
                Bankroll Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Total Bankroll
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-mono-nums">
                    $
                  </span>
                  <Input
                    type="number"
                    value={settings.bankroll}
                    onChange={(e) =>
                      update("bankroll", Math.max(0, Number(e.target.value)))
                    }
                    className="pl-7 font-mono-nums"
                    min={0}
                  />
                </div>
              </div>

              <Separator className="bg-white/[0.06]" />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                    Max Single Bet (5%)
                  </p>
                  <p className="text-lg font-mono-nums text-white">
                    ${maxBet.toFixed(2)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                    Typical Bet Range
                  </p>
                  <p className="text-lg font-mono-nums text-white">
                    ${typicalLow.toFixed(2)} – ${typicalHigh.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bet Sizing */}
        <motion.div variants={fadeUp}>
          <Card className="glass border-white/[0.06] bg-transparent">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontal className="h-4 w-4 text-orange-400" />
                Bet Sizing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-gray-500 uppercase tracking-wider">
                    Kelly Multiplier
                  </Label>
                  <Badge
                    variant="outline"
                    className="border-orange-500/30 text-orange-400 font-mono-nums text-xs"
                  >
                    {getKellyLabel(settings.kellyMultiplier)} ({settings.kellyMultiplier}x)
                  </Badge>
                </div>
                <Slider
                  value={[settings.kellyMultiplier]}
                  onValueChange={(v) => update("kellyMultiplier", Array.isArray(v) ? v[0] : v)}
                  min={0.1}
                  max={0.5}
                  step={0.05}
                />

                {/* Visual scale */}
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Conservative</span>
                  <span>Moderate</span>
                  <span>Aggressive</span>
                </div>

                <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-emerald-600/40 via-yellow-600/40 to-red-600/40" />
              </div>

              <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
                <div className="flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 text-gray-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-gray-400 leading-relaxed">
                    <span className="text-white font-medium">Full Kelly</span> =
                    maximum growth but high variance.{" "}
                    <span className="text-white font-medium">Quarter Kelly</span> =
                    conservative approach with smoother equity curve.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Thresholds */}
        <motion.div variants={fadeUp}>
          <Card className="glass border-white/[0.06] bg-transparent">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="h-4 w-4 text-orange-400" />
                Thresholds
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-gray-500 uppercase tracking-wider">
                    Min Confidence
                  </Label>
                  <span className="font-mono-nums text-sm text-white">
                    {settings.minConfidence}%
                  </span>
                </div>
                <Slider
                  value={[settings.minConfidence]}
                  onValueChange={(v) => update("minConfidence", Array.isArray(v) ? v[0] : v)}
                  min={0}
                  max={80}
                  step={5}
                />
              </div>

              <Separator className="bg-white/[0.06]" />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-gray-500 uppercase tracking-wider">
                    Min Edge
                  </Label>
                  <span className="font-mono-nums text-sm text-white">
                    {settings.minEdge.toFixed(1)}%
                  </span>
                </div>
                <Slider
                  value={[settings.minEdge]}
                  onValueChange={(v) => update("minEdge", Array.isArray(v) ? v[0] : v)}
                  min={0}
                  max={10}
                  step={0.5}
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Badge
                  variant="outline"
                  className="border-white/10 text-gray-400 text-xs"
                >
                  Confidence ≥ {settings.minConfidence}%
                </Badge>
                <Badge
                  variant="outline"
                  className="border-white/10 text-gray-400 text-xs"
                >
                  Edge ≥ {settings.minEdge.toFixed(1)}%
                </Badge>
                <span className="text-[10px] text-gray-600 self-center">
                  — only matching bets shown on dashboard
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notifications */}
        <motion.div variants={fadeUp}>
          <Card className="glass border-white/[0.06] bg-transparent">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4 text-orange-400" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm text-white">
                    Email on STRONG bets
                  </Label>
                  <p className="text-xs text-gray-500">
                    Get notified when a high-confidence edge is detected
                  </p>
                </div>
                <Switch
                  checked={settings.notifications}
                  onCheckedChange={(checked: boolean) =>
                    update("notifications", checked)
                  }
                />
              </div>

              <Separator className="bg-white/[0.06]" />

              <div className="flex items-center justify-between opacity-50">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-white">
                      Push notifications
                    </Label>
                    <Badge className="bg-white/5 text-gray-500 text-[10px] border-0">
                      Coming soon
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    Browser push alerts for live edge updates
                  </p>
                </div>
                <Switch checked={false} disabled />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Database */}
        <motion.div variants={fadeUp}>
          <Card className="glass border-white/[0.06] bg-transparent">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-orange-400" />
                Database
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80 animate-pulse" />
                <div>
                  <p className="text-sm text-white">Not configured</p>
                  <p className="text-xs text-gray-500">
                    Add Supabase environment variables to enable persistence
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3 space-y-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Required env vars
                </p>
                <div className="space-y-1.5">
                  <code className="block text-xs font-mono-nums text-orange-400/80 bg-white/[0.03] rounded px-2 py-1">
                    NEXT_PUBLIC_SUPABASE_URL
                  </code>
                  <code className="block text-xs font-mono-nums text-orange-400/80 bg-white/[0.03] rounded px-2 py-1">
                    NEXT_PUBLIC_SUPABASE_ANON_KEY
                  </code>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-gray-500 mt-0.5 shrink-0" />
                <p className="text-xs text-gray-500 leading-relaxed">
                  Without a database connection, EdgeFinder uses in-memory demo
                  data. Your settings are saved to localStorage.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Save */}
        <motion.div variants={fadeUp}>
          <Button
            onClick={handleSave}
            className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium h-11 px-8 rounded-xl shadow-lg shadow-orange-500/20 transition-all hover:shadow-orange-500/30"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
        </motion.div>
      </motion.div>

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-2 bg-emerald-600/90 backdrop-blur-lg text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-900/30 border border-emerald-500/30">
            <Check className="h-4 w-4" />
            {toast}
          </div>
        </motion.div>
      )}
    </div>
  );
}
