import { Component } from 'react'

// Catches rendering errors so one broken screen does not blank the whole site.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="card narrow" role="alert">
        <h2>Something went wrong</h2>
        <p className="muted">This page hit an unexpected error. Your data is safe. Try reloading.</p>
        <div className="row">
          <button className="btn primary" onClick={() => window.location.reload()}>Reload page</button>
          <button className="btn" onClick={() => this.setState({ error: null })}>Try again</button>
        </div>
      </div>
    )
  }
}
