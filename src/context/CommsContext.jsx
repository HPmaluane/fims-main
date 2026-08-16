// /src/context/CommsContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { genId } from "../lib/helpers";

const MESSAGES_KEY = "fims_messages";
const NOTIFICATIONS_KEY = "fims_notifications";
const MESSAGE_DRAFT_KEY = "fims_message_draft";
const ANNOUNCEMENTS_KEY = "fims_announcements";
const DISMISSED_ANN_KEY = "fims_dismissed_announcements";

// Criar o contexto
const CommsContext = createContext(null);

// Hook personalizado
export function useComms() {
  const context = useContext(CommsContext);
  if (!context) {
    throw new Error("useComms must be used within a CommsProvider");
  }
  return context;
}

// Provider component
export function CommsProvider({ children }) {
  // --- Mensagens ---
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem(MESSAGES_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  // --- Notificações ---
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem(NOTIFICATIONS_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  // --- Rascunho ---
  const [draft, setDraft] = useState(() => {
    const saved = localStorage.getItem(MESSAGE_DRAFT_KEY);
    return saved || "";
  });

  // --- Anúncios ---
  const [announcements, setAnnouncements] = useState(() => {
    const saved = localStorage.getItem(ANNOUNCEMENTS_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  // --- Anúncios dispensados ---
  const [dismissedAnn, setDismissedAnn] = useState(() => {
    const saved = localStorage.getItem(DISMISSED_ANN_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  // Persistir mensagens
  useEffect(() => {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
  }, [messages]);

  // Persistir notificações
  useEffect(() => {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  }, [notifications]);

  // Persistir rascunho
  useEffect(() => {
    if (draft) {
      localStorage.setItem(MESSAGE_DRAFT_KEY, draft);
    } else {
      localStorage.removeItem(MESSAGE_DRAFT_KEY);
    }
  }, [draft]);

  // Persistir anúncios
  useEffect(() => {
    localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(announcements));
  }, [announcements]);

  // Persistir anúncios dispensados
  useEffect(() => {
    localStorage.setItem(DISMISSED_ANN_KEY, JSON.stringify(dismissedAnn));
  }, [dismissedAnn]);

  // --- Funções de Mensagens ---
  const sendMessage = useCallback((fromId, toId, text, metadata = {}) => {
    if (!text || !text.trim()) return;
    
    const newMessage = {
      id: genId(),
      fromId: Number(fromId),
      toId: Number(toId),
      text: text.trim(),
      timestamp: new Date().toISOString(),
      read: false,
      ...metadata
    };

    setMessages(prev => [...prev, newMessage]);

    // Criar notificação para o destinatário
    let fromUser = null;
    try {
      const users = JSON.parse(localStorage.getItem("fims_users") || "[]");
      fromUser = users.find(u => u.id === Number(fromId));
    } catch (e) {
      // ignore
    }
    
    const notification = {
      id: genId(),
      userId: Number(toId),
      type: "message",
      title: `Nova mensagem de ${fromUser?.name || "Alguém"}`,
      message: text.trim().substring(0, 100) + (text.length > 100 ? "..." : ""),
      timestamp: new Date().toISOString(),
      read: false,
      link: "messages",
      fromId: Number(fromId)
    };

    setNotifications(prev => [notification, ...prev]);

    return newMessage;
  }, []);

  const markMessageAsRead = useCallback((messageId) => {
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, read: true } : m
    ));
  }, []);

  const markAllAsRead = useCallback((userId) => {
    setMessages(prev => prev.map(m => 
      m.toId === Number(userId) ? { ...m, read: true } : m
    ));
  }, []);

  const markNotificationAsRead = useCallback((notificationId) => {
    setNotifications(prev => prev.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    ));
  }, []);

  const getConversation = useCallback((userId1, userId2) => {
    return messages.filter(m => 
      (m.fromId === Number(userId1) && m.toId === Number(userId2)) ||
      (m.fromId === Number(userId2) && m.toId === Number(userId1))
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [messages]);

  const getUnreadCount = useCallback((userId) => {
    return messages.filter(m => m.toId === Number(userId) && !m.read).length;
  }, [messages]);

  const getNotificationCount = useCallback((userId) => {
    return notifications.filter(n => n.userId === Number(userId) && !n.read).length;
  }, [notifications]);

  const getRecentContacts = useCallback((userId) => {
    const userMessages = messages.filter(m => 
      m.fromId === Number(userId) || m.toId === Number(userId)
    );
    
    const contactIds = new Set();
    userMessages.forEach(m => {
      if (m.fromId !== Number(userId)) contactIds.add(m.fromId);
      if (m.toId !== Number(userId)) contactIds.add(m.toId);
    });

    let users = [];
    try {
      users = JSON.parse(localStorage.getItem("fims_users") || "[]");
    } catch (e) {
      // ignore
    }

    return Array.from(contactIds).map(id => {
      const user = users.find(u => u.id === id);
      const lastMsg = userMessages
        .filter(m => m.fromId === id || m.toId === id)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      
      return {
        user: user || { id, name: `Usuário ${id}`, role: 'unknown' },
        lastMessage: lastMsg,
        unread: messages.filter(m => m.fromId === id && m.toId === Number(userId) && !m.read).length
      };
    }).filter(item => item.user).sort((a, b) => 
      new Date(b.lastMessage?.timestamp || 0) - new Date(a.lastMessage?.timestamp || 0)
    );
  }, [messages]);

  const clearDraft = useCallback(() => {
    setDraft("");
    localStorage.removeItem(MESSAGE_DRAFT_KEY);
  }, []);

  // --- Funções de Anúncios ---
  const createAnnouncement = useCallback((text, author) => {
    if (!text || !text.trim()) return;
    
    const newAnn = {
      id: genId(),
      text: text.trim(),
      author: author || "Admin",
      timestamp: new Date().toISOString()
    };
    
    setAnnouncements(prev => [...prev, newAnn]);
    
    // Criar notificações para todos os usuários
    try {
      const users = JSON.parse(localStorage.getItem("fims_users") || "[]");
      users.forEach(user => {
        const notification = {
          id: genId(),
          userId: user.id,
          type: "announcement",
          title: "📢 Novo Anúncio",
          message: text.trim().substring(0, 100) + (text.length > 100 ? "..." : ""),
          timestamp: new Date().toISOString(),
          read: false,
          link: "dashboard",
          annId: newAnn.id
        };
        setNotifications(prev => [notification, ...prev]);
      });
    } catch (e) {
      // ignore
    }
  }, []);

  const dismissAnnouncement = useCallback((userId, annId) => {
    const dismissed = {
      userId: Number(userId),
      annId: annId,
      timestamp: new Date().toISOString()
    };
    setDismissedAnn(prev => [...prev, dismissed]);
  }, []);

  const isAnnouncementDismissed = useCallback((userId, annId) => {
    return dismissedAnn.some(d => d.userId === Number(userId) && d.annId === annId);
  }, [dismissedAnn]);

  // --- Função de Notificação Geral ---
  const notify = useCallback((userId, message, type = "general") => {
    const notification = {
      id: genId(),
      userId: Number(userId),
      type: type,
      title: type === "alert" ? "⚠️ Alerta" : "📢 Notificação",
      message: message,
      timestamp: new Date().toISOString(),
      read: false,
      link: type === "schedule" ? "schedule" : "inspections"
    };
    setNotifications(prev => [notification, ...prev]);
  }, []);

  const value = {
    // Mensagens
    messages,
    notifications,
    draft,
    setDraft,
    sendMessage,
    markMessageAsRead,
    markAllAsRead,
    markNotificationAsRead,
    getConversation,
    getUnreadCount,
    getNotificationCount,
    getRecentContacts,
    clearDraft,
    notify,
    // Anúncios
    announcements,
    createAnnouncement,
    dismissAnnouncement,
    isAnnouncementDismissed,
    dismissedAnn
  };

  return (
    <CommsContext.Provider value={value}>
      {children}
    </CommsContext.Provider>
  );
}
