# Windows 目录被占用无法删除 - 排查与处理流程

## 问题
Windows 下某个目录提示"文件被占用"无法删除，常见于 git worktree 残留、开发服务器未退出等场景。

## 快速处理流程

### 1. 找到占用进程

将以下脚本保存为 `find_cwd.ps1` 并执行：

```powershell
# find_cwd.ps1 - 通过读取进程PEB查找哪个进程的工作目录(CWD)在目标路径
Add-Type -TypeDefinition @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public class ProcessCwd
{
    [DllImport("ntdll.dll")]
    private static extern int NtQueryInformationProcess(IntPtr processHandle, int processInformationClass, ref PROCESS_BASIC_INFORMATION processInformation, int processInformationLength, ref int returnLength);

    [DllImport("kernel32.dll")]
    private static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, int dwProcessId);

    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr hObject);

    [DllImport("kernel32.dll")]
    private static extern bool ReadProcessMemory(IntPtr hProcess, IntPtr lpBaseAddress, byte[] lpBuffer, int dwSize, ref int lpNumberOfBytesRead);

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_BASIC_INFORMATION
    {
        public IntPtr Reserved1;
        public IntPtr PebBaseAddress;
        public IntPtr Reserved2_0;
        public IntPtr Reserved2_1;
        public IntPtr UniqueProcessId;
        public IntPtr Reserved3;
    }

    public static string GetCwd(int pid)
    {
        IntPtr hProcess = OpenProcess(0x0410, false, pid);
        if (hProcess == IntPtr.Zero) return null;
        try
        {
            var pbi = new PROCESS_BASIC_INFORMATION();
            int retLen = 0;
            if (NtQueryInformationProcess(hProcess, 0, ref pbi, Marshal.SizeOf(pbi), ref retLen) != 0) return null;

            bool is64 = IntPtr.Size == 8;
            byte[] pebBuf = new byte[is64 ? 0x400 : 0x200];
            int bytesRead = 0;
            if (!ReadProcessMemory(hProcess, pbi.PebBaseAddress, pebBuf, pebBuf.Length, ref bytesRead)) return null;

            int ppOffset = is64 ? 0x20 : 0x10;
            IntPtr ppAddr = is64 ? (IntPtr)BitConverter.ToInt64(pebBuf, ppOffset) : (IntPtr)BitConverter.ToInt32(pebBuf, ppOffset);

            byte[] ppBuf = new byte[0x400];
            if (!ReadProcessMemory(hProcess, ppAddr, ppBuf, ppBuf.Length, ref bytesRead)) return null;

            int cdOffset = is64 ? 0x38 : 0x24;
            ushort cdLength = BitConverter.ToUInt16(ppBuf, cdOffset);
            IntPtr cdBuffer = is64 ? (IntPtr)BitConverter.ToInt64(ppBuf, cdOffset + 8) : (IntPtr)BitConverter.ToInt32(ppBuf, cdOffset + 4);

            byte[] cdBuf = new byte[cdLength];
            if (!ReadProcessMemory(hProcess, cdBuffer, cdBuf, cdLength, ref bytesRead)) return null;

            return Encoding.Unicode.GetString(cdBuf);
        }
        finally { CloseHandle(hProcess); }
    }
}
"@

$target = $args[0]
if (-not $target) { Write-Output "Usage: .\find_cwd.ps1 <target_path>"; exit 1 }

Get-Process | ForEach-Object {
    try {
        $cwd = [ProcessCwd]::GetCwd($_.Id)
        if ($cwd -and $cwd.TrimEnd('\') -eq $target) {
            Write-Output "FOUND: PID=$($_.Id) Name=$($_.ProcessName) CWD=$cwd"
        }
    } catch {}
}
```

执行方式：
```powershell
powershell -ExecutionPolicy Bypass -File find_cwd.ps1 "E:\a7\目标目录"
```

### 2. 杀进程

```powershell
Stop-Process -Id <PID> -Force
```

### 3. 删除目录

```bash
rm -rf "目标目录"
```

## 为什么常规方法不管用

| 方法 | 为什么失败 |
|------|-----------|
| `rm -rf` / `rd /s /q` | 进程CWD锁定目录，OS拒绝删除 |
| `Restart Manager API` | 只检测文件句柄，不检测CWD |
| `handle.exe` | 需要额外安装 Sysinternals |
| `takeown + icacls` | 权限没问题，是句柄占用 |
| `robocopy /MIR` | 同样无法覆盖被CWD锁定的目录 |

核心原因：Windows 不允许删除任何进程的当前工作目录（CWD），即使目录为空。必须先结束占用进程或改变其工作目录。
