; CABO Learning Hub — Windows installer (Inno Setup 6.3+).
;
; Per-user install: no administrator rights are requested, nothing is written
; outside the user's profile, and uninstall removes the app together with the
; encrypted sign-in session and diagnostic log it created.
;
; Build (from the repository root, after publishing the app):
;   iscc /DAppVersion=1.1.0 /DSourceDir=<publish dir> /DOutputDir=<out dir> native-apps\windows\installer\CABOLearningHub.iss

#ifndef AppVersion
  #define AppVersion "1.1.0"
#endif
#ifndef SourceDir
  #error SourceDir must point at the published CABO.Native output
#endif
#ifndef OutputDir
  #define OutputDir "."
#endif
#ifndef Arch
  #define Arch "x64"
#endif

#define AppName "CABO Learning Hub"
#define AppExe "CABO.Native.exe"
#define AppPublisher "CABO Solutions"

[Setup]
; AppId must never change: it ties upgrades and uninstall to this product.
AppId={{6C1C2F2E-4B7A-4E0B-9D3C-CAB0A11E2026}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL=https://cabo-learning-hub-pilot.onrender.com/
VersionInfoVersion={#AppVersion}.0
VersionInfoCompany={#AppPublisher}
VersionInfoProductName={#AppName}
VersionInfoDescription={#AppName} installer
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
DisableDirPage=auto
PrivilegesRequired=lowest
#if Arch == "arm64"
ArchitecturesAllowed=arm64
ArchitecturesInstallIn64BitMode=arm64
#else
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
#endif
MinVersion=10.0.17763
OutputDir={#OutputDir}
OutputBaseFilename=CABO-LearningHub-Setup-{#AppVersion}-{#Arch}
SetupIconFile=..\CABO.Native\Assets\cabo.ico
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
InfoBeforeFile=..\RELEASE_NOTES.md

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\RELEASE_NOTES.md"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"; WorkingDir: "{app}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Encrypted one-hour session and the PII-free diagnostic log written by the app.
Type: filesandordirs; Name: "{localappdata}\CABO\LearningHub"
Type: dirifempty; Name: "{localappdata}\CABO"
