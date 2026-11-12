# Open the workbook in its own Tableau Public process, maximise it, and capture every visible window of that
# process (the main window and any dialog) with PrintWindow. Leaves Tableau open. No clicks or keys are sent.
param([string]$Workbook, [string]$OutPrefix, [int]$Wait = 12)
$sig = @'
[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
[DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
[DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
public delegate bool EnumProc(IntPtr h, IntPtr l);
public struct RECT { public int Left, Top, Right, Bottom; }
'@
$u = Add-Type -MemberDefinition $sig -Name WinOC -Namespace PswOC -PassThru | Where-Object Name -eq 'WinOC'
Add-Type -AssemblyName System.Drawing
$before = @(Get-Process tabpublic -ErrorAction SilentlyContinue | ForEach-Object Id)
Start-Process "C:\Program Files\Tableau\Tableau Public 2026.3\bin\tabpublic.exe" -ArgumentList "`"$Workbook`""
$deadline = (Get-Date).AddSeconds(90)
do { Start-Sleep -Seconds 2; $p = Get-Process tabpublic -ErrorAction SilentlyContinue | Where-Object { $before -notcontains $_.Id -and $_.MainWindowHandle -ne 0 } } while (-not $p -and (Get-Date) -lt $deadline)
if (-not $p) { throw "no Tableau window" }
$p = $p | Select-Object -First 1
[void]$u::ShowWindow($p.MainWindowHandle, 3); Start-Sleep -Seconds $Wait
$script:found = New-Object System.Collections.ArrayList; $target = [uint32]$p.Id
$cb = [PswOC.WinOC+EnumProc]{ param($h, $l) $procId = [uint32]0; [void][PswOC.WinOC]::GetWindowThreadProcessId($h, [ref]$procId); if ($procId -eq $target -and [PswOC.WinOC]::IsWindowVisible($h)) { $sb = New-Object System.Text.StringBuilder 256; [void][PswOC.WinOC]::GetWindowText($h, $sb, 256); [void]$script:found.Add(@($h, $sb.ToString())) }; $true }
[void]$u::EnumWindows($cb, [IntPtr]::Zero)
$i = 0
foreach ($w in $script:found) {
  $r = New-Object 'PswOC.WinOC+RECT'; [void]$u::GetWindowRect($w[0], [ref]$r); $ww = $r.Right - $r.Left; $hh = $r.Bottom - $r.Top
  if ($ww -lt 50 -or $hh -lt 50) { continue }
  $bmp = New-Object System.Drawing.Bitmap $ww, $hh; $g = [System.Drawing.Graphics]::FromImage($bmp); $hdc = $g.GetHdc(); [void]$u::PrintWindow($w[0], $hdc, 2); $g.ReleaseHdc($hdc); $g.Dispose()
  $path = "$OutPrefix-$i.png"; $bmp.Save($path); $bmp.Dispose(); "window $i '$($w[1])' ${ww}x${hh} -> $path"; $i++
}
"pid $($p.Id)"
