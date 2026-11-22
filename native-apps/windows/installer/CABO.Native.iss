; CABO Learning Hub — Windows installer (Inno Setup 6).
; Built by .github/workflows/native-windows-release.yml. Per-user install, no
; administrator rights, standard uninstaller. Unsigned unless the workflow
; signs the result with an owner-supplied certificate.
;
; Required defines (passed by the workflow with /D):
;   AppVersion   e.g. 0.2.0 or 0.2.0-rc.1
;   SourceDir    folder containing the Release x64 build (CABO.Native.exe)
;   OutputName   installer file name without extension
#ifndef AppVersion
  #error AppVersion must be defined
#endif
#ifndef SourceDir
  #error SourceDir must be defined
#endif
#ifndef OutputName
  #define OutputName "CABO-Learning-Hub-Setup"
#endif

[Setup]
; Fixed AppId: upgrades replace the previous install instead of adding a second one.
AppId={{6F4C2B1E-8A3D-4C7B-9E21-CAB0C0DE2026}
AppName=CABO Learning Hub
AppVersion={#AppVersion}
AppPublisher=CABO Solutions
AppPublisherURL=https://cabo-learning-hub-pilot.onrender.com/
DefaultDirName={localappdata}\Programs\CABO Learning Hub
DefaultGroupName=CABO Learning Hub
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; Windows 10 1809, matching TargetPlatformMinVersion in CABO.Native.csproj.
MinVersion=10.0.17763
OutputDir=output
OutputBaseFilename={#OutputName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\CABO.Native.exe
UninstallDisplayName=CABO Learning Hub
CloseApplications=yes
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Program files only. Debug symbols are not shipped.
Source: "{#SourceDir}\*"; DestDir: "{app}"; Excludes: "*.pdb"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\CABO Learning Hub"; Filename: "{app}\CABO.Native.exe"
Name: "{autodesktop}\CABO Learning Hub"; Filename: "{app}\CABO.Native.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\CABO.Native.exe"; Description: "{cm:LaunchProgram,CABO Learning Hub}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; The app keeps its sign-in token (DPAPI, current user) at
; %LOCALAPPDATA%\CABO\LearningHub\native-session.bin (NativeLearningService.cs).
; Remove it on uninstall so a shared school computer is not left signed in.
; The server-side session still expires on its own schedule.
Type: files; Name: "{localappdata}\CABO\LearningHub\native-session.bin"
Type: dirifempty; Name: "{localappdata}\CABO\LearningHub"
Type: dirifempty; Name: "{localappdata}\CABO"
