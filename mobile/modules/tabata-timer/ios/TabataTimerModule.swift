import ExpoModulesCore

/// FITTRACKは自端末（Android）専用配布のため、iOS側はビルドを通すだけのno-opスタブ。
/// `isNativeTimerAvailable()`はAndroid以外では常にfalseを返すべきだが、モジュール自体が
/// 存在するとJS側はネイティブ実装があると誤認するため、意図的にモジュールを登録しない
/// ことでも同じ効果は得られる。ここでは将来iOS対応する可能性に備えて骨組みだけ残し、
/// 実処理は一切行わない。
public class TabataTimerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TabataTimer")

    Events("onTimerUpdate", "onTimerComplete")

    Function("startTimer") { (_ type: String, _ seconds: Double, _ exIdx: Int?, _ setIdx: Int?, _ interval: Double) in
      // no-op（iOS未対応）
    }

    Function("startTabataTimer") { (_ exIdx: Int, _ setIdx: Int, _ work: Double, _ rest: Double, _ cycles: Int, _ interval: Double) in
      // no-op（iOS未対応）
    }

    Function("cancelTimer") {
      // no-op（iOS未対応）
    }
  }
}
