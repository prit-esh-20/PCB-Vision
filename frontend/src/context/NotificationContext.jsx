import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";

import API_CONFIG from "../config/api";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [items, setItems] = useState([]);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_CONFIG.baseUrl}/notifications`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const data = await response.json();

      setItems(data);
      setNotificationsLoaded(true);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    const interval = window.setInterval(() => {
      fetchNotifications();
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchNotifications]);

  const dismiss = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(({ type = "info", title, message }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    setItems((prev) => [
      ...prev,
      {
        id,
        type,
        title,
        message,
        isRead: false,
      },
    ]);

    return id;
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/notifications/read`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Failed to mark notifications as read");
      }

      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          isRead: true,
        })),
      );
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{
      items,
      notify,
      dismiss,
      fetchNotifications,
      markAllAsRead,
      notificationsLoaded,
    }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);

  if (!ctx) {
    throw new Error(
      "useNotifications must be used within NotificationProvider",
    );
  }

  return ctx;
}
