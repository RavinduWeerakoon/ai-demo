// What the two frames show. Edit here, or override per visit with query
// parameters: ?left=<url>&right=<url> (http/https only).
window.SPLIT_VIEW_CONFIG = {
  left: { url: "https://meridian.agents.agent-manager.wso2demos.com" },
  right: { label: "Agent Manager", url: "https://console.agent-manager.wso2demos.com" },
  // More views for the right pane, each a tab next to Agent Manager. With none,
  // the tab bar is not shown.
  rightTabs: [
    { label: "Agent Insights", url: "https://insights.agents.agent-manager.wso2demos.com" },
  ],
};
