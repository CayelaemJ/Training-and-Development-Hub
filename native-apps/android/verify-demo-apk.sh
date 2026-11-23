#!/usr/bin/env bash
set -euo pipefail

apk=${1:?Usage: verify-demo-apk.sh path/to/demo.apk}
package=za.co.cabosolutions.learninghub.demo
sdk=${ANDROID_SDK_ROOT:-${ANDROID_HOME:?Set ANDROID_SDK_ROOT or ANDROID_HOME}}
aapt=$(find "$sdk/build-tools" -type f -name aapt | sort -V | tail -n 1)
badging=$("$aapt" dump badging "$apk")
printf '%s\n' "$badging" | sed -n '/^package:/p; /^application:/p; /^launchable-activity:/p'
grep -Fq "package: name='$package'" <<< "$badging"
grep -Eq "^application: label='CABO Learning Hub Demo' icon='[^']+'" <<< "$badging"
grep -Fq "launchable-activity: name='za.co.cabosolutions.learninghub.MainActivity'" <<< "$badging"
if grep -Fq 'android.permission.INTERNET' <<< "$badging"; then
    echo "The offline demo APK requests Internet access." >&2
    exit 1
fi

adb install -r "$apk"
launch=$(adb shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -p "$package")
printf '%s\n' "$launch"
grep -Fq 'Status: ok' <<< "$launch"

# Look for the role switcher in the UI of the installed APK, without signing in.
for attempt in {1..10}; do
    if adb shell uiautomator dump /sdcard/cabo-demo-window.xml >/dev/null; then
        screen=$(adb shell cat /sdcard/cabo-demo-window.xml)
        if [[ $screen == *'text="Child"'* && $screen == *'text="Teacher"'* && $screen == *'text="Parent"'* ]]; then
            echo "CABO demo opened to the offline role switcher."
            exit 0
        fi
    fi
    sleep 2
done
echo "The installed APK did not show the offline role switcher." >&2
exit 1
