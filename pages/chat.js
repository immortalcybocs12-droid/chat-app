import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { db, storage } from '../utils/firebase';
import {
    collection, query, where, onSnapshot, addDoc,
    orderBy, serverTimestamp, deleteDoc, doc, getDocs, updateDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function Chat() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const messagesEndRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Load user (Local Storage + Auth Check)
    useEffect(() => {
        const stored = localStorage.getItem('chat_user');
        if (!stored) {
            router.push('/');
            return;
        }
        setUser(JSON.parse(stored));
    }, [router]);

    // Load Users List (Real-time from Firestore)
    useEffect(() => {
        if (!user) return;
        if (!db) {
            alert("Firebase not initialized. Check console/environment variables.");
            console.error("Firebase DB is undefined. Env vars missing in Netlify?");
            return;
        }
        const q = query(collection(db, 'users'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersList = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(u => u.username !== user.username); // Filter by username to avoid displaying self (id might differ if local storage is stale)
            setUsers(usersList);
        });
        return () => unsubscribe();
    }, [user]);

    // Load Messages (Real-time)
    useEffect(() => {
        if (!user || !selectedUser) return;

        const chatId = [user.id, selectedUser.id].sort().join('_');
        const messagesRef = collection(db, 'chats', chatId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Client-side filtering for "Disappearing"
            const now = Date.now();
            const visibleMsgs = msgs.filter(m => {
                if (!m.seenAt) return true;
                const timeSinceSeen = now - m.seenAt.toMillis();

                // 2 minutes expiration
                if (timeSinceSeen > 2 * 60 * 1000) {
                    // Start deletion if I am the sender
                    if (m.senderId === user.id) {
                        deleteDoc(doc(db, 'chats', chatId, 'messages', m.id)).catch(err => console.error("Auto-delete error", err));
                    }
                    return false;
                }
                return true;
            });

            setMessages(visibleMsgs);
        });

        return () => unsubscribe();
    }, [user, selectedUser]);


    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async (e) => {
        e.preventDefault();
        if ((!message.trim() && !uploading) || !selectedUser) return;
        if (!db) return alert("Firebase not initialized.");

        const chatId = [user.id, selectedUser.id].sort().join('_');
        const messagesRef = collection(db, 'chats', chatId, 'messages');

        await addDoc(messagesRef, {
            senderId: user.id,
            receiverId: selectedUser.id,
            content: message,
            type: 'text',
            createdAt: serverTimestamp(),
            seenAt: null
        });

        setMessage('');
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedUser) return;

        setUploading(true);
        try {
            // Upload to Firebase Storage
            const storageRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            const chatId = [user.id, selectedUser.id].sort().join('_');
            const messagesRef = collection(db, 'chats', chatId, 'messages');

            let type = 'file';
            if (file.type.startsWith('image/')) type = 'image';
            if (file.type.startsWith('video/')) type = 'video';

            await addDoc(messagesRef, {
                senderId: user.id,
                receiverId: selectedUser.id,
                content: 'Shared a file',
                type: type,
                file_path: downloadURL,
                createdAt: serverTimestamp(),
                seenAt: null
            });

        } catch (err) {
            console.error(err);
            alert('Upload error');
        } finally {
            setUploading(false);
            e.target.value = null;
        }
    };

    // Helper to mark seen
    const markAsSeen = async (msg) => {
        // logic moved to separate component or effect
    }

    if (!user) return null;

    return (
        <div className="chat-layout fade-in">
            <aside className="sidebar">
                <div className="sidebar-header">
                    Logged as: {user.username}
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
                            {messages.map(msg => {
                                const isMyMsg = msg.senderId === user.id;
                                return (
                                    <MessageItem
                                        key={msg.id}
                                        msg={msg}
                                        isMyMsg={isMyMsg}
                                        chatId={[user.id, selectedUser.id].sort().join('_')}
                                        user={user}
                                    />
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
                                {uploading ? '⏳' : '📎'}
                            </button>
                            <input
                                className="chat-input"
                                placeholder="Type a message..."
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                            />
                            <button className="send-btn" type="submit">Send</button>
                        </form>
                    </>
                ) : (
                    <div className="empty-state">
                        <h2>Select a user to start chatting</h2>
                    </div>
                )}
            </main>
        </div>
    );
}

// Sub-component to handle "Seen" marking individually
// This prevents the main list from re-rendering or running loops


function MessageItem({ msg, isMyMsg, chatId, user }) {
    useEffect(() => {
        if (!isMyMsg && !msg.seenAt) {
            const mark = async () => {
                try {
                    const msgRef = doc(db, 'chats', chatId, 'messages', msg.id);
                    await updateDoc(msgRef, {
                        seenAt: serverTimestamp()
                    });
                } catch (e) { console.error("Mark seen error", e); }
            };
            mark();
        }
    }, [isMyMsg, msg.seenAt, msg.id, chatId]);

    const isSeen = !!msg.seenAt;

    return (
        <div className={`message-wrapper ${isMyMsg ? 'sent' : 'received'}`}>
            <div className="message-bubble" onContextMenu={e => e.preventDefault()}>
                {msg.type === 'text' && msg.content}
                {msg.type === 'image' && <img src={msg.file_path} style={{ maxWidth: '200px' }} />}
                {msg.type === 'video' && <video src={msg.file_path} controls controlsList="nodownload" style={{ maxWidth: '200px' }} />}
                {msg.type === 'file' && <a href={msg.file_path} target="_blank" rel="noreferrer">File</a>}

                <div className="timer-indicator">
                    {isMyMsg && (isSeen ? "Seen" : "Sent")}
                    {!isMyMsg && isSeen && " Vanishing..."}
                </div>
            </div>
        </div>
    );
}
