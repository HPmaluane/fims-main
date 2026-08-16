// /src/pages/Messages.jsx
import { useState, useEffect, useRef } from "react";
import { useComms } from "../context/CommsContext";
import { ROLES } from "../data/constants";
import { Icon } from "../lib/icons";

export default function Messages({ users, currentUser }) {
  const { 
    messages, 
    draft, 
    setDraft, 
    sendMessage, 
    getConversation, 
    getUnreadCount,
    getRecentContacts,
    markAllAsRead,
    clearDraft
  } = useComms();
  
  const [activeChat, setActiveChat] = useState(null);
  const [text, setText] = useState(draft || "");
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Restaurar rascunho ao mudar de conversa
  useEffect(() => {
    if (activeChat) {
      const savedDraft = draft || "";
      setText(savedDraft);
    }
  }, [activeChat, draft]);

  // Salvar rascunho automaticamente
  useEffect(() => {
    const timer = setTimeout(() => {
      if (text && text.trim()) {
        setDraft(text);
      } else {
        setDraft("");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [text, setDraft]);

  // Scroll para o final das mensagens
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeChat]);

  // Foco no textarea quando abrir conversa
  useEffect(() => {
    if (activeChat && textareaRef.current) {
      setTimeout(() => textareaRef.current.focus(), 100);
    }
  }, [activeChat]);

  // Determinar com quem o usuário pode falar
  const getAvailableUsers = () => {
    let available = [];
    
    if (currentUser.role === ROLES.INSPECTOR) {
      // Inspetor fala apenas com supervisores
      available = users.filter(u => 
        u.role === ROLES.SUPERVISOR || u.role === ROLES.ADMIN
      );
    } else if (currentUser.role === ROLES.SUPERVISOR) {
      // Supervisor fala com inspetores e CEO
      available = users.filter(u => 
        u.role === ROLES.INSPECTOR || u.role === ROLES.CEO || u.role === ROLES.ADMIN
      );
    } else if (currentUser.role === ROLES.CEO) {
      // CEO fala com supervisores
      available = users.filter(u => 
        u.role === ROLES.SUPERVISOR || u.role === ROLES.ADMIN
      );
    } else {
      // Admin fala com todos
      available = users.filter(u => u.id !== currentUser.id);
    }
    
    return available;
  };

  // Obter contatos recentes (com base nas conversas)
  const recentContacts = getRecentContacts(currentUser.id);
  const availableUsers = getAvailableUsers();
  
  // Combinar contatos recentes com disponíveis
  const contactList = availableUsers.map(u => {
    const recent = recentContacts.find(r => r.user?.id === u.id);
    return {
      user: u,
      lastMessage: recent?.lastMessage || null,
      unread: getUnreadCount(u.id)
    };
  }).sort((a, b) => {
    // Ordenar por não lidas primeiro, depois por última mensagem
    if (a.unread > 0 && b.unread === 0) return -1;
    if (a.unread === 0 && b.unread > 0) return 1;
    return new Date(b.lastMessage?.timestamp || 0) - new Date(a.lastMessage?.timestamp || 0);
  });

  // Filtrar por busca
  const filteredContacts = contactList.filter(c => 
    c.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Enviar mensagem
  const handleSend = () => {
    if (!text.trim() || !activeChat) return;
    
    sendMessage(currentUser.id, activeChat.id, text.trim());
    setText("");
    clearDraft();
    
    // Marcar mensagens como lidas ao enviar
    markAllAsRead(activeChat.id);
  };

  // Tecla Enter para enviar (Shift+Enter para nova linha)
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Selecionar conversa
  const handleSelectChat = (contact) => {
    setActiveChat(contact.user);
    // Marcar mensagens como lidas
    markAllAsRead(contact.user.id);
    // Restaurar rascunho
    setText(draft || "");
  };

  // Obter mensagens da conversa atual
  const chatMessages = activeChat 
    ? getConversation(currentUser.id, activeChat.id)
    : [];

  // Formatar hora
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
  };

  // Agrupar mensagens por data
  const groupMessagesByDate = (msgs) => {
    const groups = {};
    msgs.forEach(msg => {
      const date = new Date(msg.timestamp).toLocaleDateString("pt-PT");
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  };

  const groupedMessages = groupMessagesByDate(chatMessages);

  return (
    <div style={{ 
      display: "flex", 
      height: "calc(100vh - 160px)", 
      background: "#fff", 
      borderRadius: 12, 
      border: "1px solid #E5E7EB", 
      overflow: "hidden"
    }}>
      {/* Sidebar - Lista de contatos */}
      <div style={{ 
        width: 280, 
        borderRight: "1px solid #E5E7EB", 
        display: "flex", 
        flexDirection: "column",
        background: "#F9FAFB"
      }}>
        <div style={{ 
          padding: "16px", 
          fontWeight: 600, 
          borderBottom: "1px solid #E5E7EB",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span>💬 Conversas</span>
          <span style={{ fontSize: 12, color: "#888" }}>
            {contactList.filter(c => c.unread > 0).length} não lidas
          </span>
        </div>
        
        <div style={{ padding: "10px 12px" }}>
          <input
            type="text"
            placeholder="🔍 Buscar contato..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #D1D5DB",
              borderRadius: 6,
              fontSize: 13,
              outline: "none"
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredContacts.length === 0 ? (
            <div style={{ 
              padding: "40px 20px", 
              textAlign: "center", 
              color: "#888",
              fontSize: 13
            }}>
              {searchTerm ? "Nenhum contato encontrado" : "Nenhuma conversa ativa"}
            </div>
          ) : (
            filteredContacts.map(contact => (
              <div 
                key={contact.user.id} 
                onClick={() => handleSelectChat(contact)} 
                style={{ 
                  padding: "12px 16px", 
                  cursor: "pointer", 
                  borderBottom: "1px solid #F3F4F6",
                  background: activeChat?.id === contact.user.id ? "#E6F1FB" : "transparent",
                  display: "flex", 
                  alignItems: "center", 
                  gap: 12,
                  transition: "background 0.2s",
                  position: "relative"
                }}
                onMouseEnter={(e) => {
                  if (activeChat?.id !== contact.user.id) {
                    e.currentTarget.style.background = "#F3F4F6";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeChat?.id !== contact.user.id) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: "50%", 
                  background: "#1E2A3A", 
                  color: "#fff", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  fontSize: 14, 
                  fontWeight: 600,
                  flexShrink: 0
                }}>
                  {contact.user.avatar || contact.user.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center"
                  }}>
                    <div style={{ 
                      fontSize: 14, 
                      fontWeight: contact.unread > 0 ? 600 : 500,
                      color: contact.unread > 0 ? "#1E2A3A" : "#4B5563"
                    }}>
                      {contact.user.name}
                    </div>
                    {contact.lastMessage && (
                      <div style={{ fontSize: 10, color: "#888" }}>
                        {formatTime(contact.lastMessage.timestamp)}
                      </div>
                    )}
                  </div>
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    marginTop: 2
                  }}>
                    <div style={{ 
                      fontSize: 12, 
                      color: contact.unread > 0 ? "#1E2A3A" : "#888",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 130,
                      fontWeight: contact.unread > 0 ? 500 : 400
                    }}>
                      {contact.lastMessage?.text || `Clique para conversar com ${contact.user.name}`}
                    </div>
                    {contact.unread > 0 && (
                      <span style={{
                        background: "#A32D2D",
                        color: "white",
                        borderRadius: "50%",
                        padding: "2px 8px",
                        fontSize: 10,
                        fontWeight: 600,
                        minWidth: 20,
                        textAlign: "center"
                      }}>
                        {contact.unread}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>
                    {contact.user.role === ROLES.INSPECTOR ? "🔍 Inspetor" :
                     contact.user.role === ROLES.SUPERVISOR ? "📋 Supervisor" :
                     contact.user.role === ROLES.CEO ? "👔 CEO" : "⚙️ Admin"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fff" }}>
        {activeChat ? (
          <>
            {/* Cabeçalho do chat */}
            <div style={{ 
              padding: "16px 20px", 
              borderBottom: "1px solid #E5E7EB", 
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#F9FAFB"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: "50%", 
                  background: "#1E2A3A", 
                  color: "#fff", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  fontSize: 13, 
                  fontWeight: 600
                }}>
                  {activeChat.avatar || activeChat.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{activeChat.name}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    {activeChat.role === ROLES.INSPECTOR ? "🔍 Inspetor" :
                     activeChat.role === ROLES.SUPERVISOR ? "📋 Supervisor" :
                     activeChat.role === ROLES.CEO ? "👔 CEO" : "⚙️ Admin"}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#888" }}>
                {getUnreadCount(activeChat.id) > 0 && (
                  <span style={{ color: "#A32D2D" }}>
                    {getUnreadCount(activeChat.id)} não lidas
                  </span>
                )}
              </div>
            </div>

            {/* Mensagens */}
            <div style={{ 
              flex: 1, 
              padding: "16px 20px", 
              overflowY: "auto", 
              background: "#FAFAFA",
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}>
              {Object.keys(groupedMessages).length === 0 ? (
                <div style={{ 
                  flex: 1, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  color: "#888",
                  fontSize: 14,
                  flexDirection: "column",
                  gap: 8
                }}>
                  <span style={{ fontSize: 40 }}>💬</span>
                  <span>Nenhuma mensagem ainda</span>
                  <span style={{ fontSize: 12, color: "#aaa" }}>
                    Envie uma mensagem para {activeChat.name}
                  </span>
                </div>
              ) : (
                Object.entries(groupedMessages).map(([date, msgs]) => (
                  <div key={date}>
                    <div style={{ 
                      textAlign: "center", 
                      fontSize: 11, 
                      color: "#888",
                      padding: "4px 0",
                      marginBottom: 8
                    }}>
                      {date === new Date().toLocaleDateString("pt-PT") ? "Hoje" : date}
                    </div>
                    {msgs.map(msg => {
                      const isOwn = msg.fromId === currentUser.id;
                      return (
                        <div 
                          key={msg.id} 
                          style={{ 
                            display: "flex",
                            justifyContent: isOwn ? "flex-end" : "flex-start",
                            marginBottom: 4
                          }}
                        >
                          <div style={{ maxWidth: "75%" }}>
                            <div style={{ 
                              background: isOwn ? "#1E2A3A" : "#fff", 
                              color: isOwn ? "#fff" : "#1F2937",
                              padding: "10px 14px", 
                              borderRadius: 12, 
                              borderBottomRightRadius: isOwn ? 4 : 12,
                              borderBottomLeftRadius: isOwn ? 12 : 4,
                              border: isOwn ? "none" : "1px solid #E5E7EB",
                              fontSize: 13,
                              wordWrap: "break-word",
                              boxShadow: isOwn ? "none" : "0 1px 2px rgba(0,0,0,0.05)"
                            }}>
                              {msg.text}
                            </div>
                            <div style={{ 
                              fontSize: 9, 
                              color: "#aaa", 
                              textAlign: isOwn ? "right" : "left", 
                              marginTop: 4,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              justifyContent: isOwn ? "flex-end" : "flex-start"
                            }}>
                              {formatTime(msg.timestamp)}
                              {isOwn && msg.read && (
                                <span style={{ color: "#0F6E56" }}>✓✓ Lida</span>
                              )}
                              {isOwn && !msg.read && (
                                <span style={{ color: "#888" }}>✓ Enviada</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de mensagem */}
            <div style={{ 
              padding: "12px 16px", 
              borderTop: "1px solid #E5E7EB", 
              display: "flex", 
              gap: 8,
              background: "#fff",
              alignItems: "flex-end"
            }}>
              <textarea 
                ref={textareaRef}
                className="form-input" 
                placeholder={`Escrever mensagem para ${activeChat.name}...`} 
                value={text} 
                onChange={e => setText(e.target.value)} 
                onKeyDown={handleKeyDown}
                style={{ 
                  flex: 1, 
                  resize: "vertical",
                  minHeight: 40,
                  maxHeight: 120,
                  padding: "10px 12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: 8,
                  fontSize: 13,
                  outline: "none",
                  fontFamily: "inherit"
                }}
                rows={1}
              />
              <button 
                className="btn btn-primary" 
                onClick={handleSend}
                disabled={!text.trim()}
                style={{
                  padding: "10px 20px",
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: text.trim() ? "#1E2A3A" : "#D1D5DB",
                  color: text.trim() ? "white" : "#888",
                  border: "none",
                  borderRadius: 8,
                  cursor: text.trim() ? "pointer" : "not-allowed",
                  fontSize: 13,
                  fontWeight: 500,
                  transition: "all 0.2s"
                }}
              >
                <Icon name="send" size={14} />
                Enviar
              </button>
            </div>
          </>
        ) : (
          <div style={{ 
            flex: 1, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            flexDirection: "column",
            gap: 12,
            color: "#888"
          }}>
            <span style={{ fontSize: 48 }}>💬</span>
            <span style={{ fontSize: 16, fontWeight: 500 }}>Selecione uma conversa</span>
            <span style={{ fontSize: 13 }}>Escolha um contato da lista ao lado para começar</span>
          </div>
        )}
      </div>
    </div>
  );
}
