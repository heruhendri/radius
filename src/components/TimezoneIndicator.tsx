"use client";

import { useTimezone } from "@/hooks/useTimezone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TimezoneIndicatorProps {
  showSelector?: boolean;
  compact?: boolean;
}

export function TimezoneIndicator({ 
  showSelector = false, 
  compact = false 
}: TimezoneIndicatorProps) {
  const { 
    timezone, 
    setTimezone, 
    getTimezoneInfo, 
    availableTimezones,
    isLoaded 
  } = useTimezone();
  
  const tzInfo = getTimezoneInfo();

  if (!showSelector) {
    // Just show indicator
    return (
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <Clock className="w-3 h-3" />
        <span>{isLoaded ? tzInfo.name : 'Loading...'}</span>
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {!compact && (
            <span className="text-xs">{isLoaded ? tzInfo.name : '...'}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Zona Waktu</span>
            <span className="text-xs text-gray-500">{tzInfo.offset}</span>
          </div>
          
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Group by region */}
              <div className="text-xs font-semibold text-gray-500 px-2 py-1">Indonesia</div>
              {availableTimezones.filter(tz => tz.region === 'Indonesia').map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label} ({tz.offset})
                </SelectItem>
              ))}
              <div className="text-xs font-semibold text-gray-500 px-2 py-1 mt-1">Southeast Asia</div>
              {availableTimezones.filter(tz => tz.region === 'Southeast Asia').map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label} ({tz.offset})
                </SelectItem>
              ))}
              <div className="text-xs font-semibold text-gray-500 px-2 py-1 mt-1">Asia</div>
              {availableTimezones.filter(tz => tz.region === 'Asia').map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label} ({tz.offset})
                </SelectItem>
              ))}
              <div className="text-xs font-semibold text-gray-500 px-2 py-1 mt-1">Australia & Pacific</div>
              {availableTimezones.filter(tz => tz.region === 'Australia' || tz.region === 'Pacific').map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label} ({tz.offset})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <p className="text-[10px] text-gray-500">
            Timezone diambil dari Company Settings. Perubahan di sini bersifat sementara.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default TimezoneIndicator;
