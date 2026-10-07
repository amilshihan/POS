# Sends the ESC/POS cash-drawer "kick" command as a raw print job through the
# Windows printer driver for $PrinterName. Works regardless of whether the
# printer is connected via USB, LPT, or network, because it goes through the
# same OS print spooler any normal print job uses (unlike WebUSB, which many
# installed printer drivers block from browsers entirely).

param(
  [Parameter(Mandatory = $true)]
  [string]$PrinterName
)

$ErrorActionPreference = "Stop"

Add-Type -Name RawPrinterHelper -Namespace Win32 -MemberDefinition @"
[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
public struct DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
}

[DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

[DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
public static extern bool ClosePrinter(IntPtr hPrinter);

[DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, DOCINFOA di);

[DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
public static extern bool EndDocPrinter(IntPtr hPrinter);

[DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
public static extern bool StartPagePrinter(IntPtr hPrinter);

[DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
public static extern bool EndPagePrinter(IntPtr hPrinter);

[DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, Int32 dwCount, out Int32 dwWritten);
"@

function Send-RawBytesToPrinter {
  param([string]$PrinterName, [byte[]]$Bytes)

  $hPrinter = [IntPtr]::Zero
  if (-not [Win32.RawPrinterHelper]::OpenPrinter($PrinterName, [ref]$hPrinter, [IntPtr]::Zero)) {
    $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
    throw "Could not open printer '$PrinterName' (Win32 error $err). Check the printer name matches exactly what's in Windows Settings > Printers & scanners."
  }

  try {
    $di = New-Object Win32.RawPrinterHelper+DOCINFOA
    $di.pDocName = "Open Cash Drawer"
    $di.pOutputFile = $null
    $di.pDataType = "RAW"

    if (-not [Win32.RawPrinterHelper]::StartDocPrinter($hPrinter, 1, $di)) {
      throw "StartDocPrinter failed for '$PrinterName'."
    }
    try {
      if (-not [Win32.RawPrinterHelper]::StartPagePrinter($hPrinter)) {
        throw "StartPagePrinter failed for '$PrinterName'."
      }
      try {
        $written = 0
        $ok = [Win32.RawPrinterHelper]::WritePrinter($hPrinter, $Bytes, $Bytes.Length, [ref]$written)
        if (-not $ok -or $written -ne $Bytes.Length) {
          throw "WritePrinter wrote $written of $($Bytes.Length) bytes to '$PrinterName'."
        }
      } finally {
        [Win32.RawPrinterHelper]::EndPagePrinter($hPrinter) | Out-Null
      }
    } finally {
      [Win32.RawPrinterHelper]::EndDocPrinter($hPrinter) | Out-Null
    }
  } finally {
    [Win32.RawPrinterHelper]::ClosePrinter($hPrinter) | Out-Null
  }
}

# ESC p 0 25 250 — standard ESC/POS drawer-kick command.
$kick = [byte[]](0x1B, 0x70, 0x00, 0x19, 0xFA)

Send-RawBytesToPrinter -PrinterName $PrinterName -Bytes $kick
Write-Output "OK"
