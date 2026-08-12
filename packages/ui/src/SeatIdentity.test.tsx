import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SeatIdentity } from './SeatIdentity';

describe('SeatIdentity', () => {
  it('renders the avatar, badge, name, and status text', async () => {
    await render(<SeatIdentity name="West AI" statusText="3 tricks" />);
    expect(screen.getByTestId('seat-identity-avatar')).toBeTruthy();
    expect(screen.getByTestId('seat-identity-badge')).toBeTruthy();
    expect(screen.getByText('West AI')).toBeTruthy();
    expect(screen.getByText('3 tricks')).toBeTruthy();
  });

  it('applies no transform for the default horizontal orientation', async () => {
    await render(<SeatIdentity name="You" statusText="0 tricks" />);
    const node = screen.getByTestId('seat-identity');
    const styleArray = Array.isArray(node.props.style) ? node.props.style : [node.props.style];
    expect(styleArray.some((s: any) => s != null && s.transform != null)).toBe(false);
  });

  it('rotates 90deg for rotated-left', async () => {
    await render(<SeatIdentity name="West AI" statusText="0 tricks" orientation="rotated-left" />);
    const node = screen.getByTestId('seat-identity');
    const styleArray = Array.isArray(node.props.style) ? node.props.style : [node.props.style];
    const transformStyle = styleArray.find((s: any) => s != null && s.transform != null);
    expect(transformStyle.transform).toEqual([{ rotate: '90deg' }]);
  });

  it('rotates -90deg for rotated-right', async () => {
    await render(<SeatIdentity name="East AI" statusText="0 tricks" orientation="rotated-right" />);
    const node = screen.getByTestId('seat-identity');
    const styleArray = Array.isArray(node.props.style) ? node.props.style : [node.props.style];
    const transformStyle = styleArray.find((s: any) => s != null && s.transform != null);
    expect(transformStyle.transform).toEqual([{ rotate: '-90deg' }]);
  });

  it('renders a different avatar image when the avatar prop changes', async () => {
    const { rerender } = await render(<SeatIdentity name="You" statusText="0 tricks" />);
    const defaultSource = screen.getByTestId('seat-identity-avatar-image').props.source;

    await rerender(<SeatIdentity name="You" statusText="0 tricks" avatar="female-02" />);
    const femaleSource = screen.getByTestId('seat-identity-avatar-image').props.source;

    expect(femaleSource).not.toEqual(defaultSource);
  });
});
