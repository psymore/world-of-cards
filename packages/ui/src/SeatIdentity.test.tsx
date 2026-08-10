import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SeatIdentity } from './SeatIdentity';

describe('SeatIdentity', () => {
  it('renders the plaque, avatar, badge, name, and trick count', async () => {
    await render(<SeatIdentity name="West AI" trickCount={3} />);
    expect(screen.getByTestId('seat-identity-plaque')).toBeTruthy();
    expect(screen.getByTestId('seat-identity-avatar')).toBeTruthy();
    expect(screen.getByTestId('seat-identity-badge')).toBeTruthy();
    expect(screen.getByText('West AI')).toBeTruthy();
    expect(screen.getByText('3 tricks')).toBeTruthy();
  });

  it('applies no transform for the default horizontal orientation', async () => {
    await render(<SeatIdentity name="You" trickCount={0} />);
    const node = screen.getByTestId('seat-identity');
    const styleArray = Array.isArray(node.props.style) ? node.props.style : [node.props.style];
    expect(styleArray.some((s: any) => s != null && s.transform != null)).toBe(false);
  });

  it('rotates 90deg for rotated-left', async () => {
    await render(<SeatIdentity name="West AI" trickCount={0} orientation="rotated-left" />);
    const node = screen.getByTestId('seat-identity');
    const styleArray = Array.isArray(node.props.style) ? node.props.style : [node.props.style];
    const transformStyle = styleArray.find((s: any) => s != null && s.transform != null);
    expect(transformStyle.transform).toEqual([{ rotate: '90deg' }]);
  });

  it('rotates -90deg for rotated-right', async () => {
    await render(<SeatIdentity name="East AI" trickCount={0} orientation="rotated-right" />);
    const node = screen.getByTestId('seat-identity');
    const styleArray = Array.isArray(node.props.style) ? node.props.style : [node.props.style];
    const transformStyle = styleArray.find((s: any) => s != null && s.transform != null);
    expect(transformStyle.transform).toEqual([{ rotate: '-90deg' }]);
  });
});
