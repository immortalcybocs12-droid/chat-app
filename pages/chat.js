
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import io from 'socket.io-client';

export default function Chat() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const messagesEndRef = useRef(null);
    const socketRef = useRef();
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Load user
    useEffect(() => {
        const stored = localStorage.getItem('chat_user');
        if (!stored) {
            router.push('/');
            return;
        }
        setUser(JSON.parse(stored));
    }, [router]);

    // Load users list
    useEffect(() => {
        if (!user) return;
        fetch('/api/users')
            .then(res => res.json())
            .then(data => {
                setUsers(data.filter(u => u.id !== user.id));
            });
    }, [user]);

    // Socket connection
    useEffect(() => {
        if (!user) return;
        fetch('/api/socket');

        socketRef.current = io();

        socketRef.current.on('connect', () => {
            console.log('Connected to server with ID:', socketRef.current.id);
            console.log('Joining room:', user.id);
            socketRef.current.emit('join', user.id);
        });

        socketRef.current.on('new_message', (msg) => {
            console.log('Received message:', msg);
            setMessages(prev => [...prev, msg]);
        });

        socketRef.current.on('message_status_update', (update) => {
            setMessages(prev => prev.map(m =>
                m.id === update.id ? { ...m, ...update } : m
            ));
        });

        socketRef.current.on('messages_deleted', (ids) => {
            setMessages(prev => prev.filter(m => !ids.includes(m.id)));
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [user]);

    // Mark messages as seen
    useEffect(() => {
        if (!user || !selectedUser || !socketRef.current) return;

        const unseenIds = messages
            .filter(m => m.receiver_id === user.id && m.sender_id === selectedUser.id && !m.is_seen)
            .map(m => m.id);

        if (unseenIds.length > 0) {
            socketRef.current.emit('mark_seen', unseenIds);
        }
    }, [user, selectedUser, messages]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, selectedUser]);


    const sendMessage = (e) => {
        e.preventDefault();
        if (!message.trim() || !selectedUser || !socketRef.current) return;

        const payload = {
            sender_id: user.id,
            receiver_id: selectedUser.id,
            content: message,
            type: 'text'
        };
        console.log('Sending message:', payload);

        socketRef.current.emit('send_message', payload);
        setMessage('');
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedUser) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (res.ok) {
                // Send socket message with file info
                const payload = {
                    sender_id: user.id,
                    receiver_id: selectedUser.id,
                    content: 'Shared a file', // Fallback text
                    type: data.type,
                    file_path: data.filePath
                };
                socketRef.current.emit('send_message', payload);
            } else {
                alert('Upload failed: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error(err);
            alert('Upload error');
        } finally {
            setUploading(false);
            e.target.value = null; // Reset input
        }
    };

    const getConversation = () => {
        if (!selectedUser) return [];
        return messages.filter(m =>
            (m.sender_id === user.id && m.receiver_id === selectedUser.id) ||
            (m.sender_id === selectedUser.id && m.receiver_id === user.id)
        ).sort((a, b) => a.created_at - b.created_at);
    };

    // Prevent context menu (Right click)
    const handleContextMenu = (e) => {
        e.preventDefault();
    };

    if (!user) return null;

    return (
        <div className="chat-layout fade-in">
            <aside className="sidebar">
                <div className="sidebar-header">
                    Users
                    <span style={{ fontSize: '0.8rem', display: 'block', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Logged as: {user.username}
                    </span>
                </div>
                <div className="user-list">
                    {users.map(u => (
                        <div
                            key={u.id}
                            className={`user-item ${selectedUser?.id === u.id ? 'active' : ''}`}
                            onClick={() => setSelectedUser(u)}
                        >
                            <div className="user-avatar">{u.username[0].toUpperCase()}</div>
                            <div>{u.username}</div>
                        </div>
                    ))}
                </div>
            </aside>

            <main className="chat-area">
                {selectedUser ? (
                    <>
                        <div className="chat-header">
                            Chat with {selectedUser.username}
                        </div>

                        <div className="messages-container">
                            {getConversation().map(msg => {
                                const isMyMsg = msg.sender_id === user.id;

                                return (
                                    <div key={msg.id} className={`message-wrapper ${isMyMsg ? 'sent' : 'received'}`}>
                                        <div
                                            className="message-bubble"
                                            onContextMenu={handleContextMenu}
                                            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                                        >
                                            {msg.type === 'text' && msg.content}

                                            {msg.type === 'image' && (
                                                <div className="media-container protected-media">
                                                    <img
                                                        src={msg.file_path}
                                                        alt="Private"
                                                        style={{ maxWidth: '200px', borderRadius: '8px', display: 'block' }}
                                                        draggable="false"
                                                    />
                                                </div>
                                            )}

                                            {msg.type === 'video' && (
                                                <div className="media-container protected-media">
                                                    <video
                                                        src={msg.file_path}
                                                        controls
                                                        controlsList="nodownload"
                                                        style={{ maxWidth: '250px', borderRadius: '8px' }}
                                                        disablePictureInPicture
                                                    />
                                                </div>
                                            )}

                                            {msg.type === 'file' && (
                                                <div className="file-attachment">
                                                    <a href={msg.file_path} target="_blank" rel="noopener noreferrer" style={{ color: '#fff' }}>
                                                        📄 File Attachment
                                                    </a>
                                                </div>
                                            )}

                                            {msg.is_seen ? (
                                                <div className="timer-indicator vanishing">
                                                    Seen. Vanishing soon...
                                                </div>
                                            ) : (
                                                isMyMsg && <div className="timer-indicator">Sent</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        <form className="input-area" onSubmit={sendMessage}>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                style={{ display: 'none' }}
                            />
                            <button
                                type="button"
                                className="icon-btn"
                                onClick={() => fileInputRef.current.click()}
                                disabled={uploading}
                                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', marginRight: '10px' }}
                            >
                                {uploading ? '⏳' : <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                    <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 015 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 005 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"></path>
                                </svg>}
                            </button>

                            <input
                                className="chat-input"
                                placeholder="Type a disappearing message..."
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                            />
                            <button className="send-btn" type="submit">
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                                </svg>
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="empty-state">
                        <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.2 }}>💬</div>
                        <h2>Select a user to start chatting</h2>
                        <p>Messages disappear 2 minutes after being seen.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
