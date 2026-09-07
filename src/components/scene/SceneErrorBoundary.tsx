import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
interface State {
  hasError: boolean;
  error?: Error;
}

export class SceneErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[SceneErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex h-full w-full items-center justify-center bg-[#0A0A0F]">
            <div className="text-center">
              <div className="mb-2 text-sm font-bold text-[#FF3333]">3D 场景渲染异常</div>
              <div className="mb-3 max-w-md text-xs text-[#A0A0B0]">
                {this.state.error?.message || 'WebGL 上下文初始化失败'}
              </div>
              <button
                className="rounded border border-[#FFE600]/30 bg-[#FFE600]/10 px-4 py-1.5 text-xs text-[#FFE600] hover:bg-[#FFE600]/20"
                onClick={() => this.setState({ hasError: false })}
              >
                重试渲染
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
