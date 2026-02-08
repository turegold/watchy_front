import React, { useEffect, useRef, useState } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

const VideoTest = ({ roomId }) => {
    const [connected, setConnected] = useState(false);
    const [videoState, setVideoState] = useState(null);
    const clientRef = useRef(null);

    useEffect(() => {
        const socket = new SockJS(`http://${window.location.hostname}:8080/ws`);

        const client = new Client({
            webSocketFactory: () => socket,
            reconnectDelay: 5000,

            onConnect: () => {
                console.log("WebSocket connected");
                setConnected(true);

                client.subscribe(
                    `/topic/rooms/${roomId}/video`,
                    (message) => {
                        const state = JSON.parse(message.body);
                        console.log("영상 상태 수신:", state);
                        setVideoState(state);
                    }
                );
            },
        });

        client.activate();
        clientRef.current = client;

        return () => {
            client.deactivate();
        };
    }, [roomId]);

    return (
        <div style={{ padding: 20 }}>
            <h2>WebSocket 테스트</h2>
            <p>연결 상태: {connected ? "연결됨" : "끊김"}</p>

            <h3>영상 상태</h3>
            <pre>{JSON.stringify(videoState, null, 2)}</pre>
        </div>
    );
};

export default VideoTest;
