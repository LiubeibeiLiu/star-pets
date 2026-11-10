import UIKit
import LocalAuthentication
import Photos
import UserNotifications

extension PetController {
    func handle(_ id:String,_ action:String,_ args:JSON) throws {
        let defaults=UserDefaults.standard
        if action=="status" {var error:NSError?;let available=LAContext().canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,error:&error);reply(id,["authenticated":unlocked,"biometric":defaults.object(forKey:"bio") as? Bool ?? true,"bioAvailable":available,"remembered":try Vault.read("rememberedPassword") != nil,"version":"1.1.0","notifications":defaults.bool(forKey:"notifications")]);return}
        if action=="login" {let password=args["password"] as? String ?? "";guard try Vault.verify(password) else{throw AppFailure("密码不正确")};if args["remember"] as? Bool == true {try Vault.write("rememberedPassword",Data(password.utf8))}else{try Vault.remove("rememberedPassword")};unlocked=true;reply(id);return}
        if action=="rememberLogin" {guard let data=try Vault.read("rememberedPassword"),let password=String(data:data,encoding:.utf8) else{throw AppFailure("尚未记住密码")};guard try Vault.verify(password) else{try Vault.remove("rememberedPassword");throw AppFailure("密码已变化，请重新输入")};unlocked=true;reply(id);return}
        if action=="systemBars" {let hex=args["color"] as? String ?? "";guard hex.count==7,hex.hasPrefix("#"),let rgb=UInt32(hex.dropFirst(),radix:16) else{throw AppFailure("颜色无效")};let color=UIColor(red:CGFloat((rgb>>16)&255)/255,green:CGFloat((rgb>>8)&255)/255,blue:CGFloat(rgb&255)/255,alpha:1);let dark=args["dark"] as? Bool ?? false;DispatchQueue.main.async{self.view.backgroundColor=color;self.web.backgroundColor=color;self.privacy?.backgroundColor=color;self.darkBars=dark;self.setNeedsStatusBarAppearanceUpdate()};reply(id);return}
        if action=="forgetLogin" {try Vault.remove("rememberedPassword");reply(id);return}
        if action=="bio" {guard defaults.object(forKey:"bio") as? Bool ?? true else{throw AppFailure("请先开启生物识别")};biometric(id,enable:false);return}
        guard unlocked else{throw AppFailure("请先解锁应用")}
        switch action {
        case "load":let state=try store.read();if let state=state{scheduleReminders(state)};reply(id,state as Any? ?? NSNull())
        case "save":guard let state=args["state"] as? JSON,let expected=args["expected"] as? Int else{throw AppFailure("缺少状态")};try store.save(state,expected:expected);scheduleReminders(state);reply(id,["ok":true])
        case "logout":unlocked=false;recording.cancel();cloud.cancel();reply(id)
        case "enableBio":if args["enabled"] as? Bool == true {biometric(id,enable:true)}else{defaults.set(false,forKey:"bio");reply(id)}
        case "aiConfig":reply(id,try cloud.config())
        case "aiConfigSave":try cloud.save(args);reply(id,["ok":true])
        case "aiKeyClear":try cloud.clear();reply(id,["ok":true])
        case "aiTest","chat":
            if action=="chat" {let state=try store.read(),settings=state?["settings"] as? JSON,companion=settings?["companion"] as? JSON;guard companion?["chatEnabled"] as? Bool == true else{throw AppFailure("云端聊天未开启")}}
            Task {do{let answer=try await cloud.complete(args,test:action=="aiTest");guard unlocked else{throw AppFailure("应用已锁定")};reply(id,answer)}catch{reply(id,error:error)}}
        case "voiceStatus","voiceRefresh":reply(id,recording.status())
        case "voiceListen":recording.listen(id,language:args["language"] as? String ?? "zh-CN")
        case "voiceStop":recording.stopListening();reply(id)
        case "voiceCancel":recording.cancel();cloud.cancel();reply(id)
        case "voiceSpeak":try recording.speak(id,args)
        case "voiceInstall","voiceSettings":reply(id,["guide":"请手动打开系统设置 → 辅助功能 → 朗读内容 → 声音，下载中文、英文声音，再回到此页重新检测。iOS 不提供直达此声音下载页面的公开接口。"])
        case "recordStart":recording.startRecording(id)
        case "recordStop":let file=try recording.stopRecording();reply(id,["file":file])
        case "camera","pickPhoto":try pickPhoto(id,camera:action=="camera")
        case "savePhoto":
            guard let encoded=args["data"] as? String,encoded.count<=22_000_000,let bytes=Data(base64Encoded:encoded),let image=UIImage(data:bytes) else{throw AppFailure("照片无效或过大")}
            let supplied=args["photoId"] as? String ?? UUID().uuidString.lowercased();guard supplied.range(of:"^[a-f0-9-]{1,64}$",options:.regularExpression) != nil else{throw AppFailure("照片编号无效")}
            let file=supplied+".jpg",url=try store.mediaURL(file)
            if !FileManager.default.fileExists(atPath:url.path){try normalized(image).write(to:url,options:[.atomic,.completeFileProtection])}
            saveAlbum(url){success in self.reply(id,["file":file,"albumSaved":success])}
        case "albumPhoto":let url=try store.mediaURL(args["file"] as? String ?? "");guard url.pathExtension=="jpg" else{throw AppFailure("照片无效")};saveAlbum(url,force:true){success in if success{self.reply(id,["ok":true])}else{self.reply(id,error:AppFailure("相册保存失败，请检查照片权限"))}}
        case "exportPhoto","exportAudio","exportBackup","importBackup","importPet":try fileAction(id,action,args)
        case "checkpoint":staged=try store.checkpoint();stagedFiles=[:];reply(id,["state":staged!])
        case "restoreCommit":
            guard staged != nil,let state=args["state"] as? JSON,let expected=args["expected"] as? Int else{throw AppFailure("没有待恢复备份")}
            try store.validate(state)
            for (name,data) in stagedFiles {let url=try store.mediaURL(name);if FileManager.default.fileExists(atPath:url.path),try Data(contentsOf:url) != data{throw AppFailure("资源编号冲突，原数据未覆盖")}}
            for (name,data) in stagedFiles {let url=try store.mediaURL(name);if !FileManager.default.fileExists(atPath:url.path){try data.write(to:url,options:[.atomic,.completeFileProtection])}}
            try store.save(state,expected:expected,restore:true);staged=nil;stagedFiles=[:];scheduleReminders(state);reply(id,["ok":true])
        case "notifications":UNUserNotificationCenter.current().requestAuthorization(options:[.alert,.sound]){ok,error in DispatchQueue.main.async{defaults.set(ok,forKey:"notifications");if let error=error{self.reply(id,error:error)}else{if let state=try? self.store.read(){self.scheduleReminders(state)};self.reply(id,["ok":ok])}}}
        default:throw AppFailure("不支持的操作："+action)
        }
    }
    func biometric(_ id:String,enable:Bool) {
        let context=LAContext();context.localizedCancelTitle="使用密码";var error:NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,error:&error) else{reply(id,error:AppFailure("设备未配置可用的生物识别，请使用密码"));return}
        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,localizedReason:"解锁星星宠物"){ok,error in DispatchQueue.main.async{if ok{self.unlocked=true;if enable{UserDefaults.standard.set(true,forKey:"bio")};self.reply(id)}else{self.reply(id,error:error ?? AppFailure("已取消生物识别"))}}}
    }
    func scheduleReminders(_ state:JSON) {
        let center=UNUserNotificationCenter.current();center.removeAllPendingNotificationRequests()
        guard UserDefaults.standard.bool(forKey:"notifications"),(state["settings"] as? JSON)?["habits"] as? Bool == true else{return}
        var calendar=Calendar.current;calendar.firstWeekday=2;let now=Date();var scheduled=0
        let settings=state["settings"] as? JSON ?? [:],events=state["events"] as? [JSON] ?? [];let reversed=Set(events.filter{$0["kind"] as? String == "reverse"}.compactMap{$0["ref"] as? String})
        for offset in 0..<7 {guard let date=calendar.date(byAdding:.day,value:offset,to:now) else{continue};let day=calendar.startOfDay(for:date)
            for h in state["habits"] as? [JSON] ?? [] {
                guard h["status"] as? String == "active",h["remind"] as? Bool == true else{continue}
                let formatter=DateFormatter();formatter.dateFormat="yyyy-MM-dd";let dayString=formatter.string(from:day)
                if let start=h["start"] as? String,!start.isEmpty,dayString<start{continue};if let end=h["end"] as? String,!end.isEmpty,dayString>end{continue}
                let frequency=h["frequency"] as? String ?? "daily"
                if frequency=="days",!(h["days"] as? [Int] ?? []).contains(calendar.component(.weekday,from:day)-1){continue}
                if frequency=="interval",let start=formatter.date(from:h["start"] as? String ?? dayString){let days=calendar.dateComponents([.day],from:start,to:day).day ?? 0;if days % max(1,h["interval"] as? Int ?? 1) != 0{continue}}
                let count=events.filter{event in guard event["kind"] as? String == "plus",event["habitId"] as? String == h["id"] as? String,!reversed.contains(event["id"] as? String ?? ""),let at=formatter.date(from:event["day"] as? String ?? "") else{return false};return frequency=="weekly" ? calendar.dateInterval(of:.weekOfYear,for:day)?.contains(at)==true:formatter.string(from:at)==dayString}.count
                if count >= (h["target"] as? Int ?? 1){continue}
                let times=h["times"] as? [String] ?? []
                for time in times.isEmpty ? ["19:00"]:times {let parts=time.split(separator:":").compactMap{Int($0)};guard parts.count==2,let fire=calendar.date(bySettingHour:parts[0],minute:parts[1],second:0,of:day),fire>now,scheduled<60 else{continue};let qs=settings["quietStart"] as? Int ?? 21,qe=settings["quietEnd"] as? Int ?? 7;let hour=parts[0];if qs != qe && (qs>qe ? hour>=qs || hour<qe:hour>=qs && hour<qe){continue};let content=UNMutableNotificationContent();content.title="星星宠物";content.body="和伙伴完成一个小目标："+(h["name"] as? String ?? "今天的习惯");content.sound = .default;let trigger=UNCalendarNotificationTrigger(dateMatching:calendar.dateComponents([.year,.month,.day,.hour,.minute],from:fire),repeats:false);center.add(UNNotificationRequest(identifier:"habit-\(h["id"] ?? "")-\(offset)-\(time)",content:content,trigger:trigger));scheduled+=1}
            }
        }
    }
}
