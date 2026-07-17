import { useState, useEffect, useMemo } from "react";
import RoutinesPanel from "./components/RoutinesPanel";
import DietPanel from "./components/DietPanel";
import DashboardPanel from "./components/DashboardPanel";
import SettingsPanel from "./components/SettingsPanel";
import BottomNav from "./components/BottomNav";
import AppHeader from "./components/AppHeader";
import { EMPTY_TRAINING_SPLIT } from "./lib/rotation";
import "./index.css";

const DEFAULT_USER_DATA = {
	height: "",
	weight: "",
	bodyType: "mesomorfo",
	name: "",
	currentObjective: "Aumento",
	trainingSplit: EMPTY_TRAINING_SPLIT,
};

// --- Main App Component ---
function App() {
	const [activeTab, setActiveTab] = useState("diet");
	const [userData, setUserData] = useState(DEFAULT_USER_DATA);

	useEffect(() => {
		const saved = localStorage.getItem("aegifitness_user_data");
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				if (parsed && typeof parsed === "object") {
					// Merge with defaults so newly added fields exist for older users
					const merged = {
						...DEFAULT_USER_DATA,
						...parsed,
						trainingSplit: {
							...EMPTY_TRAINING_SPLIT,
							...(parsed.trainingSplit || {}),
						},
					};
					setUserData(merged);
					// Re-save so the schema is upgraded on disk
					try {
						localStorage.setItem(
							"aegifitness_user_data",
							JSON.stringify(merged),
						);
					} catch {
						/* ignore */
					}
					setActiveTab("dashboard");
					return;
				}
			} catch {
				// Corrupted storage — ignore and fall through to onboarding
			}
			setActiveTab("settings");
		} else {
			setActiveTab("settings");
		}
	}, []);

	const renderContent = () => {
		switch (activeTab) {
			case "dashboard":
				return <DashboardPanel userData={userData} key="dashboard" />;
			case "routines":
				return (
					<RoutinesPanel
						key="routines"
						userData={userData}
						setUserData={setUserData}
					/>
				);
			case "diet":
				return (
					<DietPanel key="diet" userData={userData} setUserData={setUserData} />
				);
			case "settings":
				return (
					<SettingsPanel
						userData={userData}
						setUserData={setUserData}
						key="settings"
					/>
				);
			default:
				return <DashboardPanel userData={userData} />;
		}
	};

	const initials = useMemo(() => {
		const source = (userData.name || "").trim();
		if (!source) return "AF";
		const parts = source.split(/\s+/).filter(Boolean);
		if (!parts[0]) return "AF";
		return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
	}, [userData.name]);

	return (
		<div className="app-shell">
			<AppHeader
				initials={initials}
				activeTab={activeTab}
				onChange={setActiveTab}
				onClickAvatar={() => setActiveTab("settings")}
			/>

			<main className="app-content">{renderContent()}</main>

			<BottomNav activeTab={activeTab} onChange={setActiveTab} />
		</div>
	);
}

export default App;
