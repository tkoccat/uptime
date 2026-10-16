"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Option = { value: number; label: string };

export type MonitorFormLabels = {
  name: string;
  type: string;
  target: string;
  targetHelp: string;
  keyword: string;
  interval: string;
  period: string;
  grace: string;
  graceHelp: string;
  heartbeatHelp: string;
  optional: string;
  create: string;
  types: Record<string, string>;
};

const TYPES = ["HTTP", "KEYWORD", "PING", "PORT", "DNS", "HEARTBEAT"] as const;
const select = "h-10 w-full rounded-md border bg-background px-3 text-sm";

// Tür seçimine göre alanları değiştiren monitör ekleme formu (Heartbeat için adres yerine süre/tolerans)
export function MonitorForm({
  action,
  labels,
  intervals,
  periods,
  graces,
  defaultInterval,
}: {
  action: (formData: FormData) => void | Promise<void>;
  labels: MonitorFormLabels;
  intervals: Option[];
  periods: Option[];
  graces: Option[];
  defaultInterval: number;
}) {
  const [type, setType] = useState<(typeof TYPES)[number]>("HTTP");
  const heartbeat = type === "HEARTBEAT";

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="name">{labels.name}</Label>
        <Input id="name" name="name" maxLength={100} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="type">{labels.type}</Label>
        <select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as (typeof TYPES)[number])} className={select}>
          {TYPES.map((x) => (
            <option key={x} value={x}>
              {labels.types[x]}
            </option>
          ))}
        </select>
      </div>

      {heartbeat ? (
        <>
          <p className="rounded-md bg-muted p-3 text-sm">{labels.heartbeatHelp}</p>
          <div className="space-y-1">
            <Label htmlFor="interval">{labels.period}</Label>
            <select id="interval" name="interval" defaultValue={String(periods.find((p) => p.value >= 3600)?.value ?? periods[0]?.value)} className={select}>
              {periods.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="grace">{labels.grace}</Label>
            <select id="grace" name="grace" defaultValue="300" className={select}>
              {graces.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{labels.graceHelp}</p>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1">
            <Label htmlFor="url">{labels.target}</Label>
            <Input id="url" name="url" required />
            <p className="text-xs text-muted-foreground">{labels.targetHelp}</p>
          </div>
          {type === "KEYWORD" && (
            <div className="space-y-1">
              <Label htmlFor="keyword">{labels.keyword}</Label>
              <Input id="keyword" name="keyword" maxLength={200} required />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="interval">{labels.interval}</Label>
            <select id="interval" name="interval" defaultValue={String(defaultInterval)} className={select}>
              {intervals.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      <Button type="submit" className="w-full">
        {labels.create}
      </Button>
    </form>
  );
}
