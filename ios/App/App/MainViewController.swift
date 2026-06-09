import UIKit
import Capacitor
import WebKit

class MainViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        configureMetronomeWebView()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        configureMetronomeWebView()
    }

    private func configureMetronomeWebView() {
        guard let scrollView = webView?.scrollView else { return }

        webView?.configuration.allowsInlineMediaPlayback = true
        webView?.configuration.mediaTypesRequiringUserActionForPlayback = []
        scrollView.bounces = false
        scrollView.alwaysBounceVertical = false
        scrollView.alwaysBounceHorizontal = false
        scrollView.isDirectionalLockEnabled = true
        scrollView.delaysContentTouches = false
        scrollView.canCancelContentTouches = true
        scrollView.keyboardDismissMode = .interactive
    }
}
