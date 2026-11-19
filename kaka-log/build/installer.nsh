; Preserve user data by default, including silent upgrades.
!macro customUnInstall
  IfSilent kaka_keep_data
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "KAKA 사용자 데이터도 삭제하시겠습니까? (차량, 정비 기록, 설정, 로컬 백업)" IDNO kaka_keep_data
  MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "사용자 데이터를 영구 삭제하시겠습니까? 되돌릴 수 없습니다." IDNO kaka_keep_data
  SetShellVarContext current
  RMDir /r "$APPDATA\KAKA"
  IfFileExists "$APPDATA\KAKA\*.*" 0 kaka_keep_data
  MessageBox MB_OK|MB_ICONEXCLAMATION "일부 데이터를 삭제하지 못했습니다. KAKA를 종료하고 남은 폴더를 확인하세요."
  kaka_keep_data:
!macroend
