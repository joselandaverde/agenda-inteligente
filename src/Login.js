import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  async function registrarse() {
    setCargando(true);
    setMensaje('Creando cuenta...');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setMensaje('Error: ' + error.message);
    } else {
      setMensaje('Cuenta creada. Ya puedes entrar.');
    }
    setCargando(false);
  }

  async function entrar() {
    setCargando(true);
    setMensaje('Entrando...');
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setMensaje('Error: ' + error.message);
    }
    setCargando(false);
  }

  return (
    <div
      style={{
        padding: '40px',
        maxWidth: '400px',
        margin: '0 auto',
        fontFamily: 'Arial',
      }}
    >
      <h1>Mi Agenda</h1>
      <p style={{ color: '#666' }}>Entra o crea tu cuenta</p>

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Correo"
        style={{
          padding: '12px',
          width: '100%',
          fontSize: '16px',
          marginBottom: '10px',
          boxSizing: 'border-box',
        }}
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Contraseña"
        style={{
          padding: '12px',
          width: '100%',
          fontSize: '16px',
          marginBottom: '15px',
          boxSizing: 'border-box',
        }}
      />

      <button
        onClick={entrar}
        disabled={cargando}
        style={{
          padding: '12px 20px',
          fontSize: '16px',
          marginRight: '10px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
        }}
      >
        Entrar
      </button>

      <button
        onClick={registrarse}
        disabled={cargando}
        style={{
          padding: '12px 20px',
          fontSize: '16px',
          backgroundColor: '#eee',
          border: 'none',
          borderRadius: '4px',
        }}
      >
        Crear cuenta
      </button>

      {mensaje && <p style={{ marginTop: '15px' }}>{mensaje}</p>}
    </div>
  );
}
